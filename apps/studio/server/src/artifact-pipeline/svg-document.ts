/**
 * Byte-offset-preserving SVG document scanner — the shared parsing seam
 * under the sanitizer (which splices offending byte ranges out of the
 * original text, leaving everything else byte-identical) and the
 * violation-to-node mapper (which needs elements, attributes, ancestor
 * chains, and text content).
 *
 * Deliberately not a general XML parser: it covers what the generation
 * pipeline emits (elements, attributes, comments, CDATA, processing
 * instructions, doctype) and verifies well-formedness by tag balance and
 * attribute syntax. Anything outside that grammar is reported as
 * malformed — never served to a client.
 */

export interface SvgAttribute {
  /** Attribute name exactly as written (case preserved). */
  name: string;
  value: string;
  /** Byte span covering the attribute INCLUDING its leading whitespace. */
  start: number;
  end: number;
}

export interface SvgElement {
  /** Tag name exactly as written (XML names are case-sensitive). */
  tagName: string;
  attributes: SvgAttribute[];
  parent: SvgElement | null;
  /** Own id attribute value, when present. */
  id: string | null;
  /** Byte offset of the start tag's `<`. */
  openStart: number;
  /** Byte offset just past the start tag's `>`. */
  openEnd: number;
  /** Byte offset of the matching end tag's `<` (== openEnd when self-closing). */
  closeStart: number;
  /** Byte offset just past the matching end tag's `>`. */
  closeEnd: number;
  selfClosing: boolean;
  /** Direct text content (child element text not included). */
  text: string;
}

export interface SvgDocument {
  /** Every element in document order. */
  elements: SvgElement[];
  root: SvgElement;
  /** id values that appear more than once (first occurrence is canonical). */
  duplicateIds: string[];
}

export type SvgParseResult =
  | { ok: true; document: SvgDocument }
  | { ok: false; reason: string };

const NAME_START = /[A-Za-z_:]/;
const NAME_CHAR = /[A-Za-z0-9_:.-]/;

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function readName(text: string, at: number): string {
  if (at >= text.length || !NAME_START.test(text[at] as string)) {
    return "";
  }
  let end = at + 1;
  while (end < text.length && NAME_CHAR.test(text[end] as string)) {
    end += 1;
  }
  return text.slice(at, end);
}

/** Find the attribute value for a name (first occurrence), or null. */
export function attributeValue(
  element: SvgElement,
  name: string,
): string | null {
  for (const attribute of element.attributes) {
    if (attribute.name === name) {
      return attribute.value;
    }
  }
  return null;
}

/** The element's own id, or the nearest ancestor id — null when neither. */
export function resolveNodeId(element: SvgElement): string | null {
  let current: SvgElement | null = element;
  while (current !== null) {
    if (current.id !== null) {
      return current.id;
    }
    current = current.parent;
  }
  return null;
}

/**
 * Scan the document. Returns a typed failure (never throws) when the text
 * is not well-formed: unbalanced tags, mangled attributes, unterminated
 * constructs, or no root element.
 */
export function parseSvgDocument(text: string): SvgParseResult {
  const elements: SvgElement[] = [];
  const stack: SvgElement[] = [];
  const seenIds = new Set<string>();
  const duplicateIds: string[] = [];
  let root: SvgElement | null = null;
  let i = 0;

  const malformed = (reason: string, at: number): SvgParseResult => ({
    ok: false,
    reason: `${reason} (offset ${at})`,
  });

  while (i < text.length) {
    const lt = text.indexOf("<", i);
    if (lt === -1) {
      if (text.slice(i).trim() !== "" && stack.length > 0) {
        const top = stack[stack.length - 1] as SvgElement;
        top.text += text.slice(i);
      }
      break;
    }
    if (lt > i && stack.length > 0) {
      const top = stack[stack.length - 1] as SvgElement;
      top.text += text.slice(i, lt);
    }

    if (text.startsWith("<!--", lt)) {
      const close = text.indexOf("-->", lt + 4);
      if (close === -1) {
        return malformed("unterminated comment", lt);
      }
      i = close + 3;
      continue;
    }
    if (text.startsWith("<![CDATA[", lt)) {
      const close = text.indexOf("]]>", lt + 9);
      if (close === -1) {
        return malformed("unterminated CDATA section", lt);
      }
      if (stack.length > 0) {
        const top = stack[stack.length - 1] as SvgElement;
        top.text += text.slice(lt + 9, close);
      }
      i = close + 3;
      continue;
    }
    if (text.startsWith("<!", lt)) {
      const close = text.indexOf(">", lt + 2);
      if (close === -1) {
        return malformed("unterminated declaration", lt);
      }
      i = close + 1;
      continue;
    }
    if (text.startsWith("<?", lt)) {
      const close = text.indexOf("?>", lt + 2);
      if (close === -1) {
        return malformed("unterminated processing instruction", lt);
      }
      i = close + 2;
      continue;
    }
    if (text.startsWith("</", lt)) {
      let p = lt + 2;
      const name = readName(text, p);
      if (name === "") {
        return malformed("end tag without a name", lt);
      }
      p += name.length;
      while (p < text.length && isWhitespace(text[p] as string)) {
        p += 1;
      }
      if (text[p] !== ">") {
        return malformed(`mangled end tag </${name}`, lt);
      }
      const open = stack.pop();
      if (open === undefined || open.tagName !== name) {
        return malformed(
          `end tag </${name}> does not match open <${open?.tagName ?? "nothing"}>`,
          lt,
        );
      }
      open.closeStart = lt;
      open.closeEnd = p + 1;
      i = p + 1;
      continue;
    }

    // Start tag.
    let p = lt + 1;
    const tagName = readName(text, p);
    if (tagName === "") {
      return malformed("stray '<' is not a tag", lt);
    }
    p += tagName.length;
    const attributes: SvgAttribute[] = [];
    let selfClosing = false;
    let openEnd = -1;
    while (p < text.length) {
      const attrStart = p;
      while (p < text.length && isWhitespace(text[p] as string)) {
        p += 1;
      }
      if (text[p] === ">") {
        openEnd = p + 1;
        break;
      }
      if (text[p] === "/") {
        if (text[p + 1] !== ">") {
          return malformed(`mangled self-closing tag <${tagName}`, lt);
        }
        selfClosing = true;
        openEnd = p + 2;
        break;
      }
      const name = readName(text, p);
      if (name === "") {
        return malformed(`mangled attribute in <${tagName}>`, p);
      }
      p += name.length;
      while (p < text.length && isWhitespace(text[p] as string)) {
        p += 1;
      }
      if (text[p] !== "=") {
        return malformed(
          `attribute "${name}" in <${tagName}> has no value`,
          p,
        );
      }
      p += 1;
      while (p < text.length && isWhitespace(text[p] as string)) {
        p += 1;
      }
      const quote = text[p];
      if (quote !== '"' && quote !== "'") {
        return malformed(
          `attribute "${name}" in <${tagName}> has an unquoted value`,
          p,
        );
      }
      const valueEnd = text.indexOf(quote, p + 1);
      if (valueEnd === -1) {
        return malformed(
          `attribute "${name}" in <${tagName}> has an unterminated value`,
          p,
        );
      }
      attributes.push({
        name,
        value: text.slice(p + 1, valueEnd),
        start: attrStart,
        end: valueEnd + 1,
      });
      p = valueEnd + 1;
    }
    if (openEnd === -1) {
      return malformed(`unterminated start tag <${tagName}`, lt);
    }

    let id: string | null = null;
    for (const attribute of attributes) {
      if (attribute.name === "id") {
        id = attribute.value;
        break;
      }
    }
    if (id !== null) {
      if (seenIds.has(id)) {
        duplicateIds.push(id);
        // First occurrence stays canonical for node resolution.
        id = null;
      } else {
        seenIds.add(id);
      }
    }

    const element: SvgElement = {
      tagName,
      attributes,
      parent: stack.length > 0 ? (stack[stack.length - 1] as SvgElement) : null,
      id,
      openStart: lt,
      openEnd,
      closeStart: selfClosing ? openEnd : -1,
      closeEnd: selfClosing ? openEnd : -1,
      selfClosing,
      text: "",
    };
    if (element.parent === null) {
      if (root !== null) {
        return malformed("multiple root elements", lt);
      }
      root = element;
    }
    elements.push(element);
    if (!selfClosing) {
      stack.push(element);
    }
    i = openEnd;
  }

  if (stack.length > 0) {
    const open = stack[stack.length - 1] as SvgElement;
    return {
      ok: false,
      reason: `unclosed element <${open.tagName}> (offset ${open.openStart})`,
    };
  }
  if (root === null) {
    return { ok: false, reason: "document has no root element" };
  }
  return { ok: true, document: { elements, root, duplicateIds } };
}
