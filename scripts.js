/**
 * Wireframe.code
 * ---------------------------------------------------------------------------
 * Pipeline:   DSL text --parseSource()--> WireNode tree --renderNode()--> DOM
 *
 * DSL line format (indentation of 2 spaces = child of the line above):
 *     type "arg0" "arg1" key=value flag
 *
 * Sections in this file:
 *   1. Types & constants
 *   2. Generic helpers
 *   3. Parser
 *   4. Renderers (one function per component + registry)
 *   5. Editor wiring (DOM events, persistence, snippets)
 */

/* ===========================================================================
 * 1. TYPES & CONSTANTS
 * ======================================================================== */

/**
 * One parsed DSL line. The whole document is a tree of these.
 * @typedef {Object} WireNode
 * @property {string}   type   Component name, lowercased (e.g. "button").
 * @property {string[]} args   Quoted strings, in order of appearance.
 * @property {Object<string,string>} props  key=value pairs (values stay strings).
 * @property {string[]} flags  Bare words after the type (e.g. "primary").
 * @property {WireNode[]} kids Child nodes (derived from indentation).
 */

/** @callback NodeRenderer @param {WireNode} node @returns {HTMLElement} */

/** localStorage key used to persist the editor text. */
const STORAGE_KEY = 'wf-src';

/** Spaces per indentation level in the DSL. */
const INDENT_SIZE = 2;

/**
 * Tokenizer for one DSL line. Alternatives, in priority order:
 *   1-3: key=value  or  key="value with spaces"
 *   4:   "quoted string"  (positional argument)
 *   5:   bare word        (type for the first one, flag afterwards)
 */
const TOKEN_PATTERN = /(\w+)=(?:"([^"]*)"|(\S+))|"([^"]*)"|(\S+)/g;

/**
 * Component types that must NOT stretch to fill space when they are direct
 * children of a `row` (small / inline things like buttons and badges).
 */
const NO_AUTO_FLEX_TYPES = new Set([
    'button', 'iconbtn', 'fab', 'link', 'badge', 'chip', 'avatar',
    'checkbox', 'radio', 'toggle', 'sidebar', 'spinner', 'tooltip', 'toast',
]);

/** Document loaded on first visit and by the "Contoh" button. */
const SAMPLE_SOURCE = `# Indentasi 2 spasi = anak dari baris di atasnya
# Format: tipe "teks" "item|item" key=value flag
screen "Login" mobile
  header "MyApp" menu
  heading "Masuk" h1
  input "Email" placeholder="you@mail.com"
  input "Password" placeholder="••••••"
  checkbox "Ingat saya" checked
  button "Masuk" primary wide
  link "Lupa password?"
  alert "Password salah" error
  bottomnav "Home|Cari|Profil" active=1

screen "Dashboard" desktop
  header "MyApp" "Home|Reports|Settings"
  breadcrumb "Home|Reports"
  row
    sidebar "Menu" "Dashboard|Users|Settings" active=1
    col flex=1
      row
        card "Users"
          heading "1,204" h2
          lorem lines=2
        card "Revenue"
          image "Chart" h=70
      tabs "Semua|Aktif|Arsip" active=1
        table "Nama|Email|Status"
          tr "Ani|ani@x.com|Aktif"
          tr "Budi|budi@x.com|Arsip"
        pagination pages=5 active=2
  footer "© 2026" "Privacy|Terms"
`;

/** One example line per component; powers the clickable chips under the editor. */
const COMPONENT_SNIPPETS = {
    screen: 'screen "Home" mobile',
    header: 'header "Logo" "Home|About" menu',
    footer: 'footer "© 2026" "Privacy|Terms"',
    sidebar: 'sidebar "Menu" "Dashboard|Users" active=1',
    bottomnav: 'bottomnav "Home|Search|Profile" active=1',
    breadcrumb: 'breadcrumb "Home|Products|Shoes"',
    pagination: 'pagination pages=5 active=2',
    tabs: 'tabs "Info|Reviews" active=1',
    row: 'row',
    col: 'col flex=1',
    input: 'input "Email" placeholder="you@mail.com"',
    textarea: 'textarea "Pesan" rows=3',
    select: 'select "Negara" value="Indonesia"',
    checkbox: 'checkbox "Ingat saya" checked',
    radio: 'radio "Opsi A" checked',
    toggle: 'toggle "Notifikasi" on',
    search: 'search "Cari…"',
    slider: 'slider "Volume" value=60',
    button: 'button "Simpan" primary',
    fab: 'fab "+"',
    iconbtn: 'iconbtn "☰"',
    link: 'link "Lupa password?"',
    card: 'card "Judul"',
    list: 'list',
    item: 'item "Judul" "Subjudul"',
    table: 'table "Nama|Email|Role"',
    tr: 'tr "Ani|a@x.com|Admin"',
    accordion: 'accordion "Pertanyaan" open',
    avatar: 'avatar "AB" size=40',
    badge: 'badge "Baru"',
    chip: 'chip "Tag"',
    modal: 'modal "Konfirmasi"',
    tooltip: 'tooltip "Petunjuk"',
    alert: 'alert "Tersimpan!" success',
    toast: 'toast "Item dihapus"',
    progress: 'progress value=60',
    spinner: 'spinner',
    image: 'image "Foto" h=120',
    skeleton: 'skeleton lines=3',
    lorem: 'lorem lines=3',
    heading: 'heading "Judul" h2',
    text: 'text "Halo"',
    divider: 'divider',
};

/* ===========================================================================
 * 2. GENERIC HELPERS
 * ======================================================================== */

/**
 * Create a DOM element.
 * Text is set via textContent (never innerHTML), so user input can't inject HTML.
 * @param {string} tag
 * @param {?string} [className]
 * @param {?string} [text]
 * @returns {HTMLElement}
 */
function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
}

/**
 * Split a "a|b|c" string into trimmed, non-empty items.
 * @param {string} [text]
 * @returns {string[]}
 */
function splitItems(text) {
    return (text || '').split('|').map(item => item.trim()).filter(Boolean);
}

/** @param {WireNode} node @param {string} flag @returns {boolean} */
function hasFlag(node, flag) {
    return node.flags.includes(flag);
}

/**
 * True when `index` (0-based) is the item selected by the node's `active=N`
 * prop (which is 1-based in the DSL).
 * @param {WireNode} node
 * @param {number} index
 * @returns {boolean}
 */
function isActiveIndex(node, index) {
    return +node.props.active === index + 1;
}

/**
 * Render every child of `node` and append it to `parentElement`.
 * Inside a `row`, children share space equally unless they set `w`/`flex`
 * or are listed in NO_AUTO_FLEX_TYPES.
 * @param {HTMLElement} parentElement
 * @param {WireNode} node
 */
function appendChildren(parentElement, node) {
    const isRow = parentElement.classList.contains('row');
    node.kids.forEach(child => {
        const childElement = renderNode(child);
        const shouldAutoFlex = isRow
            && !NO_AUTO_FLEX_TYPES.has(child.type)
            && !child.props.w
            && !child.props.flex;
        if (shouldAutoFlex) childElement.style.flex = '1 1 0';
        parentElement.append(childElement);
    });
}

/**
 * Wrap a form control with an optional label (taken from the node's arg0).
 * @param {WireNode} node
 * @param {HTMLElement} control
 * @returns {HTMLElement}
 */
function createLabelledField(node, control) {
    const field = createElement('div', 'fld');
    if (node.args[0]) field.append(createElement('label', null, node.args[0]));
    field.append(control);
    return field;
}

/**
 * Create `node.props.lines` (default 3) grey bars imitating text or loading
 * content. The last bar is shorter, like the end of a paragraph.
 * @param {WireNode} node
 * @param {string} extraClass  '' for lorem text, 'sk' for skeleton.
 * @returns {HTMLElement}
 */
function createPlaceholderBars(node, extraClass) {
    const wrapper = createElement('div', 'bars ' + extraClass);
    const lineCount = +node.props.lines || 3;
    for (let i = 0; i < lineCount; i++) {
        const bar = createElement('i');
        const isLastOfMany = i === lineCount - 1 && lineCount > 1;
        if (isLastOfMany) bar.style.width = '60%';
        wrapper.append(bar);
    }
    return wrapper;
}

/**
 * Build a renderer for a plain container: a <div> with a CSS class whose
 * children are the node's children.
 * @param {string} className
 * @returns {NodeRenderer}
 */
function createContainerRenderer(className) {
    return node => {
        const container = createElement('div', className);
        appendChildren(container, node);
        return container;
    };
}

/**
 * Shared markup for checkbox / radio / toggle: <label><span mark/>text</label>.
 * @param {WireNode} node
 * @param {string} markClass  CSS class of the visual mark ('cb', 'rb', 'tg').
 * @param {string} markText   Glyph shown inside the mark ('' for none).
 * @returns {HTMLElement}
 */
function createChoiceControl(node, markClass, markText) {
    const label = createElement('label', 'chk');
    label.append(createElement('span', markClass, markText), node.args[0] || '');
    return label;
}

/* ===========================================================================
 * 3. PARSER
 * ======================================================================== */

/**
 * Indentation depth of a raw line (tabs count as one level of INDENT_SIZE).
 * @param {string} rawLine
 * @returns {number}
 */
function measureIndentLevel(rawLine) {
    const leadingWhitespace = rawLine.match(/^[ \t]*/)[0].replace(/\t/g, ' '.repeat(INDENT_SIZE));
    return Math.floor(leadingWhitespace.length / INDENT_SIZE);
}

/**
 * Turn one trimmed DSL line into a childless WireNode.
 * First bare word = type; later bare words = flags.
 * @param {string} trimmedLine
 * @returns {WireNode}
 */
function parseLine(trimmedLine) {
    /** @type {WireNode} */
    const node = { type: '', args: [], props: {}, flags: [], kids: [] };
    for (const match of trimmedLine.matchAll(TOKEN_PATTERN)) {
        const [, propKey, quotedPropValue, bareValue, quotedArg, bareWord] = match;
        if (propKey) {
            node.props[propKey] = quotedPropValue ?? bareValue;
        } else if (quotedArg !== undefined) {
            node.args.push(quotedArg);
        } else if (!node.type) {
            node.type = bareWord.toLowerCase();
        } else {
            node.flags.push(bareWord.toLowerCase());
        }
    }
    return node;
}

/**
 * Parse the whole DSL document into a tree.
 * Blank lines and lines starting with '#' are ignored. A stack of
 * (node, depth) pairs finds each line's parent from its indentation.
 * @param {string} source
 * @returns {WireNode} synthetic root (type 'root') whose kids are the top-level nodes.
 */
function parseSource(source) {
    /** @type {WireNode} */
    const root = { type: 'root', args: [], props: {}, flags: [], kids: [] };
    const ancestors = [{ node: root, depth: -1 }];

    source.split('\n').forEach(rawLine => {
        const trimmed = rawLine.trim();
        if (!trimmed || trimmed[0] === '#') return;

        const depth = measureIndentLevel(rawLine);
        const node = parseLine(trimmed);

        // Climb up until the top of the stack is a shallower line (= the parent).
        while (ancestors[ancestors.length - 1].depth >= depth) ancestors.pop();
        ancestors[ancestors.length - 1].node.kids.push(node);
        ancestors.push({ node, depth });
    });

    return root;
}

/* ===========================================================================
 * 4. RENDERERS  (WireNode -> HTMLElement)
 * Conventions: always provide a default for missing args, never throw.
 * ======================================================================== */

/* ---- Structure & navigation ---------------------------------------------- */

/** screen "Title" [mobile|tablet|desktop] -- device frame with a caption. */
function renderScreen(node) {
    const wrapper = createElement('div', 'scrw');
    const frame = createElement('div', 'scr ' + (node.flags[0] || 'desktop'));
    wrapper.append(createElement('div', 'st', node.args[0] || 'Screen'), frame);
    appendChildren(frame, node);
    return wrapper;
}

/** header "Brand" "Nav|Items" [menu] */
function renderHeader(node) {
    const bar = createElement('div', 'bar');
    if (hasFlag(node, 'menu')) bar.append(createElement('span', null, '☰'));
    bar.append(createElement('b', null, node.args[0] || 'Logo'));
    const nav = createElement('div', 'nav');
    splitItems(node.args[1]).forEach(item => nav.append(createElement('span', null, item)));
    bar.append(nav);
    return bar;
}

/** footer "Text" "Link|Items" */
function renderFooter(node) {
    const footer = createElement('div', 'ftr');
    if (node.args[0]) footer.append(createElement('span', null, node.args[0]));
    splitItems(node.args[1]).forEach(item => footer.append(createElement('span', 'lnk', item)));
    return footer;
}

/** sidebar "Title" "Menu|Items" active=N -- may also contain children. */
function renderSidebar(node) {
    const sidebar = createElement('div', 'side');
    if (node.args[0]) sidebar.append(createElement('b', null, node.args[0]));
    splitItems(node.args[1]).forEach((item, index) => {
        const activeClass = isActiveIndex(node, index) ? ' act' : '';
        sidebar.append(createElement('div', 'mi' + activeClass, item));
    });
    appendChildren(sidebar, node);
    return sidebar;
}

/** bottomnav "Item|Item" active=N -- mobile tab bar with icon boxes. */
function renderBottomNav(node) {
    const bar = createElement('div', 'bnav');
    splitItems(node.args[0]).forEach((item, index) => {
        const activeClass = isActiveIndex(node, index) ? ' act' : '';
        const entry = createElement('div', 'bi' + activeClass);
        entry.append(createElement('i'), createElement('span', null, item));
        bar.append(entry);
    });
    return bar;
}

/** breadcrumb "Home|Products|Shoes" */
function renderBreadcrumb(node) {
    return createElement('div', 'crumb', splitItems(node.args[0]).join(' › '));
}

/** pagination pages=5 active=1 */
function renderPagination(node) {
    const pageCount = +node.props.pages || 5;
    const activePage = +node.props.active || 1;
    const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1);
    const pager = createElement('div', 'pg');
    ['‹', ...pageNumbers, '›'].forEach(label => {
        const activeClass = label === activePage ? ' act' : '';
        pager.append(createElement('span', 'pgi' + activeClass, label));
    });
    return pager;
}

/** tabs "A|B|C" active=N -- children become the panel content. */
function renderTabs(node) {
    const wrapper = createElement('div');
    const tabBar = createElement('div', 'tb2');
    const activeIndex = (+node.props.active || 1) - 1;
    splitItems(node.args[0]).forEach((label, index) => {
        const activeClass = index === activeIndex ? ' act' : '';
        tabBar.append(createElement('span', 'tab' + activeClass, label));
    });
    const panel = createElement('div', 'panel');
    appendChildren(panel, node);
    wrapper.append(tabBar, panel);
    return wrapper;
}

/* ---- Form & inputs ------------------------------------------------------- */

/** Text box showing `value`, or muted `placeholder` when no value is set. */
function createTextBox(node) {
    const hasValue = Boolean(node.props.value);
    const text = node.props.value || node.props.placeholder || '';
    return createElement('div', 'box' + (hasValue ? '' : ' ph'), text);
}

/** input "Label" placeholder= value= */
function renderInput(node) {
    return createLabelledField(node, createTextBox(node));
}

/** textarea "Label" placeholder= value= rows=3 */
function renderTextarea(node) {
    const box = createTextBox(node);
    const rows = +node.props.rows || 3;
    box.style.minHeight = rows * 22 + 12 + 'px';
    return createLabelledField(node, box);
}

/** select "Label" value= */
function renderSelect(node) {
    const box = createElement('div', 'box sel');
    box.append(
        createElement('span', null, node.props.value || 'Pilih…'),
        createElement('span', null, '▾'),
    );
    return createLabelledField(node, box);
}

/** search "Placeholder" */
function renderSearch(node) {
    return createElement('div', 'box ph', '🔍 ' + (node.args[0] || 'Cari…'));
}

/** checkbox "Label" [checked] */
function renderCheckbox(node) {
    return createChoiceControl(node, 'cb', hasFlag(node, 'checked') ? '✓' : '');
}

/** radio "Label" [checked] */
function renderRadio(node) {
    return createChoiceControl(node, 'rb', hasFlag(node, 'checked') ? '●' : '');
}

/** toggle "Label" [on] */
function renderToggle(node) {
    return createChoiceControl(node, 'tg' + (hasFlag(node, 'on') ? ' on' : ''), '');
}

/** slider "Label" value=0..100 (default 50) */
function renderSlider(node) {
    const percent = Math.max(0, Math.min(100, +node.props.value || 50));
    const track = createElement('div', 'sl');
    const fill = createElement('i');
    const knob = createElement('b');
    fill.style.width = percent + '%';
    knob.style.left = percent + '%';
    track.append(fill, knob);
    return createLabelledField(node, track);
}

/* ---- Actions ------------------------------------------------------------- */

/** button "Text" [primary] [wide] */
function renderButton(node) {
    const classes = 'btn'
        + (hasFlag(node, 'primary') ? ' pri' : '')
        + (hasFlag(node, 'wide') ? ' wide' : '');
    return createElement('div', classes, node.args[0] || 'Button');
}

/** iconbtn "★" */
function renderIconButton(node) {
    return createElement('div', 'btn ic', node.args[0] || '★');
}

/** fab "+" -- floating action button */
function renderFab(node) {
    return createElement('div', 'fab', node.args[0] || '+');
}

/** link "Text" */
function renderLink(node) {
    return createElement('span', 'lnk', node.args[0] || 'Link');
}

/* ---- Data display -------------------------------------------------------- */

/** card ["Title"] -- container. */
function renderCard(node) {
    const card = createElement('div', 'card');
    if (node.args[0]) card.append(createElement('b', null, node.args[0]));
    appendChildren(card, node);
    return card;
}

/** item "Title" ["Subtitle"] [noicon] -- a row inside a `list`. */
function renderListItem(node) {
    const row = createElement('div', 'item');
    if (!hasFlag(node, 'noicon')) row.append(createElement('i', 'av sm'));
    const text = createElement('div', 'grow');
    text.append(createElement('b', null, node.args[0] || 'Item'));
    if (node.args[1]) text.append(createElement('small', null, node.args[1]));
    row.append(text, createElement('span', 'mu', '›'));
    return row;
}

/** table "Col|Col" with `tr "cell|cell"` children (other children are ignored). */
function renderTable(node) {
    const table = createElement('table');
    const headerRow = table.createTHead().insertRow();
    splitItems(node.args[0]).forEach(column => headerRow.append(createElement('th', null, column)));

    const body = table.createTBody();
    node.kids.forEach(rowNode => {
        const row = body.insertRow();
        splitItems(rowNode.args[0]).forEach(cell => { row.insertCell().textContent = cell; });
    });

    const scroller = createElement('div', 'tw'); // lets wide tables scroll sideways
    scroller.append(table);
    return scroller;
}

/** accordion "Title" [open] -- children are only rendered when open. */
function renderAccordion(node) {
    const accordion = createElement('div', 'acc');
    const isOpen = hasFlag(node, 'open');
    accordion.append(createElement('div', 'ah', (isOpen ? '▾ ' : '▸ ') + (node.args[0] || '')));
    if (isOpen) {
        const body = createElement('div', 'ab');
        appendChildren(body, node);
        accordion.append(body);
    }
    return accordion;
}

/** avatar "AB" size=40 -- shows at most 2 characters. */
function renderAvatar(node) {
    const avatar = createElement('div', 'av', (node.args[0] || '').slice(0, 2));
    const size = (node.props.size || 40) + 'px';
    avatar.style.width = avatar.style.height = size;
    return avatar;
}

/** badge "Text" */
function renderBadge(node) {
    return createElement('span', 'badge', node.args[0] || 'Badge');
}

/** chip "Text" -- a badge with a dismiss mark. */
function renderChip(node) {
    return createElement('span', 'badge', (node.args[0] || 'Chip') + ' ×');
}

/** heading "Text" [h1|h2|h3] (default h2) */
function renderHeading(node) {
    const tag = hasFlag(node, 'h1') ? 'h1' : hasFlag(node, 'h3') ? 'h3' : 'h2';
    return createElement(tag, null, node.args[0] || 'Heading');
}

/** text "Paragraph" */
function renderText(node) {
    return createElement('p', null, node.args[0] || '');
}

/** divider */
function renderDivider() {
    return createElement('hr');
}

/* ---- Feedback & overlays ------------------------------------------------- */

/** modal "Title" -- container with a title bar and close mark. */
function renderModal(node) {
    const modal = createElement('div', 'modal');
    const titleBar = createElement('div', 'mh');
    titleBar.append(createElement('b', null, node.args[0] || 'Dialog'), createElement('span', null, '×'));
    modal.append(titleBar);
    appendChildren(modal, node);
    return modal;
}

/** tooltip "Text" */
function renderTooltip(node) {
    return createElement('div', 'tip', node.args[0] || 'Tooltip');
}

/** alert "Message" [success|warning|error] (default: info) */
function renderAlert(node) {
    const icons = { success: '✓', warning: '⚠', error: '✕' };
    const icon = icons[node.flags[0]] || 'ℹ';
    return createElement('div', 'alert', icon + ' ' + (node.args[0] || ''));
}

/** toast "Message" */
function renderToast(node) {
    return createElement('div', 'toast', node.args[0] || 'Toast');
}

/** progress value=0..100 (default 50) */
function renderProgress(node) {
    const track = createElement('div', 'pbar');
    const fill = createElement('i');
    fill.style.width = (+node.props.value || 50) + '%';
    track.append(fill);
    return track;
}

/** spinner */
function renderSpinner() {
    return createElement('div', 'spin');
}

/* ---- Low-fidelity placeholders ------------------------------------------- */

/** image "Label" h=100 -- box with a diagonal cross (drawn in CSS). */
function renderImagePlaceholder(node) {
    const box = createElement('div', 'img');
    box.append(createElement('span', null, node.args[0] || 'Image'));
    box.style.minHeight = (node.props.h || 100) + 'px';
    return box;
}

/** skeleton lines=3 -- loading-state bars. */
function renderSkeleton(node) {
    return createPlaceholderBars(node, 'sk');
}

/** lorem lines=3 -- paragraph-text bars. */
function renderLoremLines(node) {
    return createPlaceholderBars(node, '');
}

/**
 * Registry: DSL type name -> renderer.
 * To add a component: write a `renderXxx(node)` function and register it here
 * (plus an entry in COMPONENT_SNIPPETS, and NO_AUTO_FLEX_TYPES if it is inline).
 * @type {Object<string, NodeRenderer>}
 */
const RENDERERS = {
    // structure & navigation
    screen: renderScreen,
    row: createContainerRenderer('row'),
    col: createContainerRenderer('col'),
    header: renderHeader,
    footer: renderFooter,
    sidebar: renderSidebar,
    bottomnav: renderBottomNav,
    breadcrumb: renderBreadcrumb,
    pagination: renderPagination,
    tabs: renderTabs,
    // form & inputs
    input: renderInput,
    textarea: renderTextarea,
    select: renderSelect,
    search: renderSearch,
    checkbox: renderCheckbox,
    radio: renderRadio,
    toggle: renderToggle,
    slider: renderSlider,
    // actions
    button: renderButton,
    iconbtn: renderIconButton,
    fab: renderFab,
    link: renderLink,
    // data display
    card: renderCard,
    list: createContainerRenderer('list'),
    item: renderListItem,
    table: renderTable,
    accordion: renderAccordion,
    avatar: renderAvatar,
    badge: renderBadge,
    chip: renderChip,
    heading: renderHeading,
    text: renderText,
    divider: renderDivider,
    // feedback & overlays
    modal: renderModal,
    tooltip: renderTooltip,
    alert: renderAlert,
    toast: renderToast,
    progress: renderProgress,
    spinner: renderSpinner,
    // placeholders
    image: renderImagePlaceholder,
    skeleton: renderSkeleton,
    lorem: renderLoremLines,
};

/**
 * Render one node: look up its renderer (unknown types become a red dashed
 * box) and apply the universal props:
 *   w=px     fixed width, opts out of flex sharing
 *   h=px     minimum height
 *   flex=N   relative flex-grow
 * @param {WireNode} node
 * @returns {HTMLElement}
 */
function renderNode(node) {
    const renderer = RENDERERS[node.type];
    const element = renderer ? renderer(node) : createElement('div', 'unk', '? ' + node.type);
    const { w, h, flex } = node.props;

    if (w) {
        element.style.width = w + 'px';
        element.style.flex = 'none';
    }
    if (h) element.style.minHeight = h + 'px';
    if (flex) element.style.flex = flex + ' 1 0';
    return element;
}

/* ===========================================================================
 * 5. EDITOR WIRING
 * ======================================================================== */

const sourceEditor = document.getElementById('src');   // <textarea> with the DSL
const previewPane = document.getElementById('pv');     // where wireframes render
const snippetChips = document.getElementById('chips'); // container for snippet buttons
const loadSampleButton = document.getElementById('demo');
const lineNumbers = document.getElementById('nums');     // gutter <pre> with 1..N
const indentGuides = document.getElementById('guides');  // <pre> layer behind the textarea
const editorPane = document.getElementById('ed');        // left (or top) pane
const appLayout = document.getElementById('app');        // grid holding editor | splitter | preview
const splitter = document.getElementById('split');       // draggable divider

/** Save the editor text; localStorage may be unavailable, so never throw. */
function saveSource() {
    try { localStorage.setItem(STORAGE_KEY, sourceEditor.value); } catch (error) { /* ignore */ }
}

/** @returns {string} the saved text, or the sample when nothing is stored/available. */
function loadSavedSource() {
    try { return localStorage.getItem(STORAGE_KEY) || SAMPLE_SOURCE; } catch (error) { return SAMPLE_SOURCE; }
}

/**
 * Re-parse the editor text and rebuild the whole preview (cheap enough for
 * wireframe-sized documents), refresh the line numbers / indent guides, then
 * persist the text. Errors are shown in the pane.
 */
function redrawPreview() {
    refreshEditorDecorations();
    previewPane.replaceChildren();
    try {
        parseSource(sourceEditor.value).kids.forEach(node => previewPane.append(renderNode(node)));
    } catch (error) {
        previewPane.append(createElement('div', 'unk', String(error)));
    }
    saveSource();
}

/**
 * Insert text at the caret through execCommand so the browser's undo stack
 * keeps working (setRangeText would break Ctrl+Z).
 * @param {string} text
 */
function insertTextAtCaret(text) {
    document.execCommand('insertText', false, text);
}

/** Leading spaces of the line that contains `position`. */
function getLineIndent(text, position) {
    const lineStart = text.lastIndexOf('\n', position - 1) + 1;
    return text.slice(lineStart, position).match(/^ */)[0];
}

/** Tab inserts one indent level; Enter keeps the current line's indentation. */
function handleEditorKeydown(event) {
    if (event.key === 'Tab') {
        event.preventDefault();
        insertTextAtCaret(' '.repeat(INDENT_SIZE));
    } else if (event.key === 'Enter') {
        event.preventDefault();
        insertTextAtCaret('\n' + getLineIndent(sourceEditor.value, sourceEditor.selectionStart));
    }
}

/**
 * Add `snippet` on a new line below the caret's current line, using that
 * line's indentation, then refresh the preview.
 * @param {string} snippet
 */
function insertSnippetBelowCurrentLine(snippet) {
    const text = sourceEditor.value;
    const caret = sourceEditor.selectionStart;
    const lineStart = text.lastIndexOf('\n', caret - 1) + 1;
    let lineEnd = text.indexOf('\n', caret);
    if (lineEnd < 0) lineEnd = text.length;
    const indent = text.slice(lineStart, lineEnd).match(/^ */)[0];

    sourceEditor.setSelectionRange(lineEnd, lineEnd);
    sourceEditor.focus();
    insertTextAtCaret('\n' + indent + snippet);
    redrawPreview();
}

/** Build one button per entry of COMPONENT_SNIPPETS. */
function createSnippetChips() {
    Object.entries(COMPONENT_SNIPPETS).forEach(([componentName, snippet]) => {
        const chip = createElement('button', null, componentName);
        chip.title = snippet;
        chip.onclick = () => insertSnippetBelowCurrentLine(snippet);
        snippetChips.append(chip);
    });
}

/* ---- Editor decorations: line numbers & indentation guides ---------------- */

/**
 * Text for the line-number gutter: "1\n2\n3…", one number per line of `text`.
 * @param {string} text
 * @returns {string}
 */
function buildLineNumbers(text) {
    const lineCount = text.split('\n').length;
    return Array.from({ length: lineCount }, (_, index) => index + 1).join('\n');
}

/**
 * HTML for the layer drawn behind the (transparent) textarea. It reproduces
 * only each line's LEADING whitespace, one marker per character:
 *   - space  -> "·" in a box tinted by indent level (alternating g0/g1, so each
 *               2-space level is visibly separate from its neighbours)
 *   - tab    -> amber box (class "tab"), so tabs never pass as spaces
 *   - a lone leftover space that breaks the 2-space rhythm -> red box (class "odd")
 * Safe for innerHTML: the output is built only from whitespace characters.
 * @param {string} text
 * @returns {string}
 */
function buildIndentGuidesHtml(text) {
    return text.split('\n').map(line => {
        const leading = line.match(/^[ \t]*/)[0];
        let column = 0;
        const markers = [...leading].map(character => {
            const tint = 'g' + (Math.floor(column / INDENT_SIZE) % 2);
            column += character === '\t' ? INDENT_SIZE : 1;
            return character === '\t'
                ? `<i class="tab ${tint}">\t</i>`
                : `<i class="sp ${tint}">·</i>`;
        });
        const breaksRhythm = column % INDENT_SIZE !== 0 && leading.endsWith(' ');
        if (breaksRhythm) {
            const last = markers.length - 1;
            markers[last] = markers[last].replace('class="sp ', 'class="sp odd ');
        }
        return markers.join('');
    }).join('\n');
}

/** Keep the gutter and guide layer aligned with the textarea's scroll position. */
function syncDecorationScroll() {
    const { scrollTop, scrollLeft } = sourceEditor;
    lineNumbers.style.transform = `translateY(${-scrollTop}px)`;
    indentGuides.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
}

/** Rebuild the line numbers and indent guides from the current editor text. */
function refreshEditorDecorations() {
    const text = sourceEditor.value;
    lineNumbers.textContent = buildLineNumbers(text);
    indentGuides.innerHTML = buildIndentGuidesHtml(text);
    syncDecorationScroll();
}

/* ---- Resizable editor (drag the splitter) --------------------------------- */

const SPLIT_STORAGE_PREFIX = 'wf-split-'; // + 'w' (side by side) or 'h' (stacked)
const SPLITTER_PX = 6;                    // must match the grid track in CSS
const MIN_PANE_PX = 200;                  // neither pane may shrink below this
const stackedLayoutQuery = window.matchMedia('(max-width: 800px)');

/** @returns {boolean} true on narrow screens, where editor sits above the preview. */
function isStackedLayout() {
    return stackedLayoutQuery.matches;
}

/** Stored sizes are kept per orientation so width and height don't clash. */
function getSplitStorageKey() {
    return SPLIT_STORAGE_PREFIX + (isStackedLayout() ? 'h' : 'w');
}

/**
 * Set the editor pane size (width, or height when stacked), clamped so both
 * panes keep at least MIN_PANE_PX.
 * @param {number} requestedPx
 */
function setEditorSize(requestedPx) {
    const total = isStackedLayout() ? appLayout.clientHeight : appLayout.clientWidth;
    const maxPx = total - SPLITTER_PX - MIN_PANE_PX;
    const sizePx = Math.max(MIN_PANE_PX, Math.min(requestedPx, maxPx));
    appLayout.style.setProperty(isStackedLayout() ? '--edh' : '--edw', sizePx + 'px');
}

/** Drop any custom size so the CSS defaults apply again. */
function clearEditorSize() {
    appLayout.style.removeProperty('--edw');
    appLayout.style.removeProperty('--edh');
}

/** Persist the editor pane's current size for the current orientation. */
function saveEditorSize() {
    const rect = editorPane.getBoundingClientRect();
    const sizePx = Math.round(isStackedLayout() ? rect.height : rect.width);
    try { localStorage.setItem(getSplitStorageKey(), String(sizePx)); } catch (error) { /* ignore */ }
}

/** Apply the saved size for the current orientation, if any. */
function restoreEditorSize() {
    clearEditorSize();
    try {
        const savedPx = +localStorage.getItem(getSplitStorageKey());
        if (savedPx) setEditorSize(savedPx);
    } catch (error) { /* ignore */ }
}

/** Double-click on the splitter: back to the default size. */
function resetEditorSize() {
    clearEditorSize();
    try { localStorage.removeItem(getSplitStorageKey()); } catch (error) { /* ignore */ }
}

/** Start a drag. Pointer capture keeps events flowing even outside the splitter. */
function handleSplitterPointerDown(event) {
    event.preventDefault();
    splitter.setPointerCapture(event.pointerId);
    splitter.classList.add('drag');
    const layoutRect = appLayout.getBoundingClientRect();

    const dragTo = moveEvent => setEditorSize(isStackedLayout()
        ? moveEvent.clientY - layoutRect.top
        : moveEvent.clientX - layoutRect.left);

    const finishDrag = () => {
        splitter.classList.remove('drag');
        splitter.removeEventListener('pointermove', dragTo);
        splitter.removeEventListener('pointerup', finishDrag);
        splitter.removeEventListener('pointercancel', finishDrag);
        saveEditorSize();
    };

    splitter.addEventListener('pointermove', dragTo);
    splitter.addEventListener('pointerup', finishDrag);
    splitter.addEventListener('pointercancel', finishDrag);
}

/** Wire events, load the saved (or sample) document, and draw it. */
function initEditor() {
    sourceEditor.addEventListener('input', redrawPreview);
    sourceEditor.addEventListener('keydown', handleEditorKeydown);
    loadSampleButton.onclick = () => {
        sourceEditor.value = SAMPLE_SOURCE;
        redrawPreview();
    };
    sourceEditor.addEventListener('scroll', syncDecorationScroll);
    splitter.addEventListener('pointerdown', handleSplitterPointerDown);
    splitter.addEventListener('dblclick', resetEditorSize);
    stackedLayoutQuery.addEventListener('change', restoreEditorSize);
    restoreEditorSize();
    createSnippetChips();
    sourceEditor.value = loadSavedSource();
    redrawPreview();
}

initEditor();