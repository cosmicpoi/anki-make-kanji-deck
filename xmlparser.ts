import * as fs from 'fs'
import { buffer } from 'stream/consumers';

type XMLAttrKey = string; // enum-like
type XMLTagName = string;
type XMLAttrObj = Partial<Record<XMLAttrKey, string>>;

// Represents <?xml ?> declaration
type XMLDeclaration = {
    version?: string;
    encoding?: string;
    standalone?: string;
};

type DtdCommonHeader = {
    tagName: string;
    source?: string;
}
type Dtd_ELEMENT = DtdCommonHeader & {
    tagName: '!ELEMENT';
    elementName: string;
    contentModel?: string;
};

type Dtd_ATTLIST_Attr = {
    attributeName: string,
    dataType: string,  // CDATA, ID, (yes|no), etc
    defaultDeclaration: {
        defaultType?: string; // #REQUIRED | #IMPLIED | #FIXED
        defaultValue?: string;
    }
};
type Dtd_ATTLIST = DtdCommonHeader & {
    tagName: '!ATTLIST',
    elementName: string;
    attributes: Dtd_ATTLIST_Attr[];
};

type Dtd_ENTITY = DtdCommonHeader & {
    tagName: '!ENTITY',
    key: string;
    value: string;
};

type Dtd_NOTATION = DtdCommonHeader & {
    tagName: '!NOTATION',
    // to implement
}
export type XMLDtdDecl = Dtd_ELEMENT | Dtd_ATTLIST | Dtd_ENTITY | Dtd_NOTATION;

type XMLDoctype = {
    rootTagName: string; // name of root tag
    public?: string;
    external?: string;
    internal?: XMLDtdDecl[];
}

// Represents an XML opening tag
type XMLTagProps = {
    source?: string;
    tagName: XMLTagName;
    attributes?: XMLAttrObj;
};


type ParamXMLAttrObj<PAttrKey extends XMLAttrKey> =
    XMLAttrObj & Partial<Record<keyof PAttrKey, string>>;

// Represents an XML opening tag with a schema
type ParamXMLTagProps<
    PTagName extends XMLTagName,
    PAttrKey extends XMLAttrKey
> = XMLTagProps & {
    source?: string;
    tagName: PTagName;
    attributes?: ParamXMLAttrObj<PAttrKey>;
}

// Convert `type` tag with props to XMLProps struct
const as_xml_props = (
    tagName: string,
    attributes: XMLAttrObj | undefined = undefined,
    source: string | undefined = undefined
): XMLTagProps => {
    const props: XMLTagProps = { tagName };
    if (attributes) props.attributes = attributes;
    if (source) props.source = source;

    return props;
}

type XMLElement = XMLTagProps & {
    children?: (XMLElement | 'string' | 'number')[]
};

export type ParamXMLElement<
    PTagName extends XMLTagName,
    PAttrKey extends XMLAttrKey
> = ParamXMLTagProps<PTagName, PAttrKey> & {
    children?: (XMLElement | string | number)[]
};

// Helper functions
// Take a stripped start tag (A for <A> or <A/ >) and get its attrs
function getTagAttrsFromStripped<
    PTagName extends XMLTagName = XMLTagName,
    PAttrKey extends XMLAttrKey = XMLAttrKey
>(stripped: string): [PTagName, ParamXMLAttrObj<PAttrKey> | undefined] {
    let tagType = stripped;
    const tagAttrs: ParamXMLAttrObj<PAttrKey> = {};
    let hasAttrs = false;
    if (stripped.includes('=')) {
        const parts = stripped.split(' ');
        // has props, need to unpack them
        tagType = parts[0];
        for (let i = 1; i < parts.length; i++) {
            const attrSrc = parts[i];
            const kv = attrSrc.split("=");
            const attrKey = kv[0];
            const attrVal = kv[1].slice(1, -1);

            // @ts-ignore
            tagAttrs[attrKey] = attrVal;
            hasAttrs = true;
        }
    }
    const attrs = hasAttrs ? tagAttrs : undefined;
    return [tagType as PTagName, attrs];
}

function trimQuotes(str: string) {
    let mystr = str;
    if (mystr.at(0) == '"') mystr = mystr.substring(1);
    if (mystr.at(-1) == '"') mystr = mystr.slice(0, -1);
    return mystr;
}

function splitAroundBoundaries(content: string): string[] {
    const k_BUF_SIZE = 1024;
    const closeTag = {
        '"': '"',
        '(': ')',
    };
    const trimmed = content.trim();

    const res: string[] = [];
    const buf: string[] = Array(k_BUF_SIZE).fill('\0');
    let bufLength: number = 0;

    const flushCharBuffer = (reset: boolean = true): string => {
        const slice: string[] = buf.slice(0, bufLength);
        const res = slice.join('');

        if (reset) {
            buf.fill('\0', 0, bufLength);
            bufLength = 0;
        }

        return res;
    }

    for (const char of content) {
        if (buf[0] == '"' || buf[0] == '(') {
            const prevChar = buf[bufLength - 1];
            if (bufLength > 1 && char == closeTag[buf[0]]) {
                res.push(flushCharBuffer() + char);
                continue;
            }
            else {
                buf[bufLength++] = char;
            }
        }
        else if (char.match(/\s/)) {
            res.push(flushCharBuffer());
        }
        else if (char == '"' || char == '(') {
            res.push(flushCharBuffer());
            buf[bufLength++] = char;
        }
        else {
            buf[bufLength++] = char;
        }
    }

    return res.filter(s => s.length > 0);
}

export type ParamXMLParserHandlerObj<
    PTagName extends XMLTagName,
    PAttrKey extends XMLAttrKey
> = {
    onDeclaration?: (decl: XMLDeclaration) => void,
    onDoctype?: (dc: XMLDoctype) => void,
    onElements?: Partial<Record<
        PTagName,
        (k: ParamXMLElement<PTagName, PAttrKey>) => void
    >>,
    onDtdDecl?: (dtd: XMLDtdDecl) => void;
    onComment?: (cmt: string) => void;
    addSource?: Partial<Record<PTagName, boolean> & {
        '!ELEMENT': boolean,
        '!ENTITY': boolean,
        '!ATTLIST': boolean,
        '!NOTATION': boolean,
    }>;
};

// Function handlers for `parseXML` - basically a function for each tag type

const k_BUF_MAX_SIZE = 1024 * 64;
const k_COMMENT_MAX_LENGTH = 1024;
export async function parseXML<
    PTagName extends XMLTagName = XMLTagName,
    PAttrKey extends XMLAttrKey = XMLAttrKey
>(
    filePath: string,
    props: ParamXMLParserHandlerObj<PTagName, PAttrKey> = {}
): Promise<void> {
    const p_getTagAttrsFromStripped = getTagAttrsFromStripped<PTagName, PAttrKey>;
    // Types
    type PTagProps = ParamXMLTagProps<PTagName, PAttrKey>;
    type PAttrObj = ParamXMLAttrObj<PAttrKey>;
    type PElement = ParamXMLElement<PTagName, PAttrKey>;

    // Create filestream
    const fileStream = fs.createReadStream(filePath);
    // const fileStream = fs.createReadStream(filePath);

    const stream = fs.createReadStream(filePath, {
        // highWaterMark: 1024,
        encoding: 'utf-8',
    });

    // Allocate buffers: token, string, element
    type DtdOpenToken = '<!ELEMENT' | '<!ATTLIST' | '<!ENTITY' | '<!NOTATION';
    type POpenToken = PTagProps | '<' | '<!DOCTYPE' | '<!--' | '<?' | '[' | DtdOpenToken;
    type PCloseToken = { tagName: PTagName } | '>' | ']' | '-->' | '?>' | ']';

    const prevTokens: POpenToken[] = [];

    const strBuffer = new Array(k_BUF_MAX_SIZE).fill('\0');
    let strBufferLength: number = 0;

    let currDoctype: XMLDoctype | undefined = undefined;
    const currElementMap: Partial<Record<PTagName, PElement | undefined>> = {};


    // Token and buffer handlers
    const getNthParent = (n: number): POpenToken | undefined =>
        prevTokens.length >= n ? prevTokens[prevTokens.length - n] : undefined;
    const getPrevToken = (): POpenToken | undefined => getNthParent(1)
    const isMatchedPair = (t1: POpenToken, t2: PCloseToken): boolean => {
        if (t1 == '<' && t2 == '>') return true;
        if (t1 == '<!DOCTYPE' && t2 == '>') return true;
        if (t1 == '<!ELEMENT' && t2 == '>') return true;
        if (t1 == '<!ENTITY' && t2 == '>') return true;
        if (t1 == '<!ATTLIST' && t2 == '>') return true;
        if (t1 == '<!NOTATION' && t2 == '>') return true;
        if (t1 == '<!--' && t2 == '-->') return true;
        if (t1 == '<?' && t2 == '?>') return true;
        if (t1 == '[' && t2 == ']') return true;
        if (typeof t1 != 'object' || typeof t2 != 'object') return false;
        if (t1.tagName == t2.tagName) return true;
        return false;
    }

    const tryPopToken = (endToken: PCloseToken): boolean => {
        const prevToken = prevTokens.pop();
        if (!prevToken) {
            throw 'Prev token is undefined';
        }
        if (!isMatchedPair(prevToken, endToken)) {
            throw 'Could not match tokens' + prevToken.toString() + ',' + endToken.toString();
        }
        if (typeof endToken == 'object') {
            if (currElementMap[endToken.tagName] == undefined) throw "Map entry null";
            const el = currElementMap[endToken.tagName];
            currElementMap[endToken.tagName] = undefined;
        }
        return true;
    }
    const pushToken = (token: POpenToken): void => {
        prevTokens.push(token)
        if (typeof token == 'object') {
            if (currElementMap[token.tagName] != undefined) throw "Map entry non-null";
            currElementMap[token.tagName] = { ...token };
        }
    };
    const replaceTopToken = (token: POpenToken): void => {
        prevTokens[prevTokens.length - 1] = token;
    }

    const bufferCharacter = (nextChar: string) => {
        strBuffer[strBufferLength++] = nextChar;
    }

    // Keep a rolling buffer up until the given length. Used for look-behind on ]> and -->
    const bufferCharMaxLen = (nextChar: string, maxLen: number) => {
        bufferCharacter(nextChar);
        if (strBufferLength > maxLen) {
            for (let i = 0; i < maxLen; i++) {
                strBuffer[i] = strBuffer[i + 1];
            }
            strBuffer[maxLen] = '\0';
            strBufferLength--;
        }
    }

    const flushCharBuffer = (reset: boolean = true): string => {
        const slice: string[] = strBuffer.slice(0, strBufferLength);
        const res = slice.join('');

        if (reset) {
            strBuffer.fill('\0', 0, strBufferLength);
            strBufferLength = 0;
        }

        return res;
    }

    const pushSelfClosingTag = (tagProps: PTagProps) => {
        // const el: PElement = {
        //     ...tagProps,
        // }
        // return el;
    }

    const handleTag = (withoutBrackets: string): boolean => {
        let stripped = withoutBrackets;
        const hasFrontSlash: boolean = stripped.at(0) == '/';
        if (hasFrontSlash) {
            stripped = stripped.substring(1);
        }
        const hasBackSlash: boolean = stripped.at(-1) == '/';
        if (hasBackSlash) {
            stripped = stripped.slice(0, -1);
        }

        const prevToken = getPrevToken();
        if (typeof prevToken == 'string') {
            console.error("Invalid token");
            return false;
        }

        const [tagName, attributes] = p_getTagAttrsFromStripped(stripped);
        const isEndTag: boolean = hasFrontSlash && (prevToken?.tagName == tagName);

        // End tag
        if (isEndTag) {
            if (!tryPopToken({ tagName })) throw "Could not pop tag";
        }
        // Self-closing tag
        else if (hasBackSlash) {
            pushSelfClosingTag({ tagName, attributes });
        }
        // Start tag
        else if (!hasFrontSlash && !hasBackSlash) {
            pushToken({ tagName, attributes });
        }
        else {
            console.error("handleTag error: Something weird happened")
            return false;
        }

        return true;
    }

    const dtd_tags: POpenToken[] = ['<!ENTITY', '<!ELEMENT', '<!NOTATION', '<!ATTLIST'];



    // File parsing logic
    try {
        stream.on('data', (chunk) => {
            for (const char of chunk as string) {
                const flushBufWithCurrentChar = (reset: boolean = true): string =>
                    flushCharBuffer(reset) + char;


                const prevToken = getPrevToken();
                if (prevToken == '<!--') {
                    if (char == '>') {
                        let contents = flushCharBuffer(false);
                        if (contents.length >= 2 && contents.slice(-2) == '--') {
                            if (!tryPopToken('-->')) throw 'Pop token failed';
                            if (props.onComment) props.onComment('<!--' + contents + '-->');
                            flushCharBuffer();
                            continue;
                        }
                    }
                    else {
                        bufferCharMaxLen(char, k_COMMENT_MAX_LENGTH);
                        // bufferCharacter(char)
                        continue;
                    }
                }
                else if (prevToken == '<?') {
                    if (char == '>') {
                        let contents = flushCharBuffer();
                        if (contents.slice(-1) != '?') throw "Invalid <?xml ?> declaration format";
                        contents = contents.slice(0, -1);
                        const [_, attrs] = getTagAttrsFromStripped(contents);
                        if (!tryPopToken('?>')) throw 'Pop token failed';
                        if (props.onDeclaration) props.onDeclaration({ ...attrs } as XMLDeclaration);
                        continue;
                    }
                    else {
                        bufferCharacter(char);
                        continue;
                    }
                }
                else if (prevToken == '<!DOCTYPE') {
                    if (char == '[') {
                        pushToken('[');
                        const content = flushCharBuffer()
                        const rootTagName = content.replace(/\s/g, '');
                        currDoctype = { rootTagName };
                        continue;
                    }
                    else if (char == '>') {
                        tryPopToken('>');
                        flushCharBuffer();
                        continue;
                    }
                }
                else if (prevToken == '[') {
                    const parentToken = getNthParent(2);
                    if (parentToken != '<!DOCTYPE') throw "Invalid token";


                    if (char == ']') {
                        tryPopToken(']');
                        if (!currDoctype) throw 'currDocType is undefined';
                        if (props.onDoctype) props.onDoctype({ ...currDoctype });
                        currDoctype = undefined;
                        continue;
                    }

                    let matchedDtd = false;
                    const content = flushBufWithCurrentChar(false);
                    for (const tag of dtd_tags) {
                        if (typeof tag == 'object') continue;
                        if (content.slice(-1 * tag.length) == tag) {
                            pushToken(tag);
                            flushCharBuffer();
                            matchedDtd = true;
                            break;
                        }
                    }
                    if (matchedDtd) continue;

                    if (content.slice(-1 * '<!--'.length) == '<!--') {
                        pushToken('<!--');
                        flushCharBuffer();
                        continue;
                    }

                    bufferCharacter(char);
                    continue;
                }
                else if (prevToken == '<!ELEMENT') {
                    if (char == '>') {
                        tryPopToken('>');
                        const content = flushCharBuffer().trim();
                        const parts = splitAroundBoundaries(content);
                        const elementName = parts[0];
                        const contentModel = parts[1];

                        let dtd: Dtd_ELEMENT = {
                            tagName: '!ELEMENT', elementName, contentModel
                        };

                        if (props.addSource?.['!ELEMENT']) {
                            dtd.source = prevToken + content + '>';
                        }

                        if (props.onDtdDecl) props.onDtdDecl(dtd);

                        continue;
                    }
                    else {
                        bufferCharacter(char);
                        continue;
                    }
                }
                else if (prevToken == '<!ENTITY') {
                    if (char == '>') {
                        tryPopToken('>');
                        const content = flushCharBuffer().trim();
                        const parts = splitAroundBoundaries(content);
                        const key = parts[0];
                        const value = parts[1];
                        let dtd: Dtd_ENTITY = {
                            tagName: '!ENTITY',
                            key,
                            value: trimQuotes(value),
                        };

                        if (props.addSource?.['!ENTITY']) {
                            dtd.source = prevToken + content + '>';
                        }

                        if (props.onDtdDecl) props.onDtdDecl(dtd);

                        continue;
                    }
                    else {
                        bufferCharacter(char);
                        continue;
                    }
                }
                else if (prevToken == '<!ATTLIST') {
                    if (char == '>') {
                        tryPopToken('>');
                        const content = flushCharBuffer();
                        const parts = splitAroundBoundaries(content.trim());

                        const elementName = parts[0];
                        let dtd: Dtd_ATTLIST = {
                            tagName: '!ATTLIST',
                            elementName,
                            attributes: [],
                        };

                        const defaultAttr = () => ({
                            attributeName: '',
                            dataType: '',
                            defaultDeclaration: {}
                        });

                        let currAttr: Dtd_ATTLIST_Attr = defaultAttr();

                        for (let i = 1; i < parts.length; i++) {
                            const part = parts[i];
                            if (part.at(0) == '#')
                                currAttr.defaultDeclaration.defaultType = part;
                            else if (part.at(0) == '"')
                                currAttr.defaultDeclaration.defaultValue = trimQuotes(part);
                            else {
                                if (currAttr.attributeName == '')
                                    currAttr.attributeName = part;
                                else if (currAttr.dataType == '')
                                    currAttr.dataType = part;
                                else {
                                    dtd.attributes.push(currAttr);
                                    currAttr = defaultAttr();
                                    currAttr.attributeName = part;
                                }
                            }
                        }
                        if (currAttr.attributeName != '' && currAttr.dataType != '') {
                            dtd.attributes.push(currAttr);
                            currAttr = defaultAttr();
                        }

                        if (props.addSource?.['!ATTLIST']) {
                            dtd.source = prevToken + content + '>';
                        }
                        if (props.onDtdDecl) props.onDtdDecl(dtd);

                        continue;
                    }
                    else {
                        bufferCharacter(char);
                        continue;
                    }
                }
                else if (prevToken == '<!NOTATION') {
                    
                }
                else if (prevToken == '<') {
                    if (char == '>') {
                        const tagContents = flushCharBuffer();
                        if (!tryPopToken('>')) throw new Error();
                        if (!handleTag(tagContents)) throw new Error();
                        continue;
                    }
                    else if (char == '?') {
                        replaceTopToken('<?');
                        continue;
                    }

                    const bufferContent = flushBufWithCurrentChar(false);
                    if (bufferContent == '!--') {
                        replaceTopToken('<!--');
                        flushCharBuffer();
                        continue;
                    }
                    else if (bufferContent == '!DOCTYPE') {
                        replaceTopToken('<!DOCTYPE')
                        flushCharBuffer();
                        continue;
                    }

                    bufferCharacter(char);
                    continue;
                }
                else {
                    if (char == '<') {
                        pushToken('<');
                        continue;
                    }
                }
            }
        });
    } catch (err) {
        console.error(err);
    }
}