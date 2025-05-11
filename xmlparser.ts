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

type Dtd_ELEMENT = {
    tagName: 'ELEMENT';
    elementName: string;
    contentModel?: string;
};

type Dtd_ATTLIST = {
    tagName: 'ATTLIST',
    elementName: string;
    attributeName?: string;
    attributeType?: string;
    defaultDeclaration?: string; // #REQUIRED, #IMPLIED, etc
};

type Dtd_ENTITY = {
    tagName: 'ENTITY',
    key: string;
    value: string;
};

type Dtd_NOTATION = {
    tagName: 'NOTATION',
    // to implement
}
type XMLDtd_Decl = Dtd_ELEMENT | Dtd_ATTLIST | Dtd_ENTITY | Dtd_NOTATION;

type XMLDoctype = {
    rootTagName: string; // name of root tag
    public?: string;
    external?: string;
    internal?: XMLDtd_Decl[];
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

export type ParamXMLParserHandlerObj<
    PTagName extends XMLTagName,
    PAttrKey extends XMLAttrKey
> = {
    declaration?: (decl: XMLDeclaration) => void,
    doctype?: (dc: XMLDoctype) => void,
    elements?: Partial<Record<
        PTagName,
        (k: ParamXMLElement<PTagName, PAttrKey>) => void
    >>
};

// Function handlers for `parseXML` - basically a function for each tag type

const k_BUF_MAX_SIZE = 1024 * 64;
export async function parseXML<
    PTagName extends XMLTagName = XMLTagName,
    PAttrKey extends XMLAttrKey = XMLAttrKey
>(
    filePath: string,
    handlers: ParamXMLParserHandlerObj<PTagName, PAttrKey> = {}
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
    type POpenToken = PTagProps | '<' | '<!DOCTYPE' | '<!--' | '<?';
    type PCloseToken = { tagName: PTagName } | '>' | ']>' | '-->' | '?>';

    const prevTokens: POpenToken[] = [];

    const strBuffer = new Array(k_BUF_MAX_SIZE).fill('\0');
    let strBufferLength: number = 0;

    const currElementMap: Partial<Record<PTagName, PElement | undefined>> = {};

    // Token and buffer handlers
    const getPrevToken = (): POpenToken | undefined =>
        prevTokens.length != 0 ? prevTokens[prevTokens.length - 1] : undefined;
    const isMatchedPair = (t1: POpenToken, t2: PCloseToken): boolean => {
        if (t1 == '<' && t2 == '>') return true;
        if (t1 == '<!DOCTYPE' && t2 == ']>') return true;
        if (t1 == '<!--' && t2 == '-->') return true;
        if (t1 == '<?' && t2 == '?>') return true;
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

    // File parsing logic
    try {
        stream.on('data', (chunk) => {
            for (const char of chunk as string) {
                const prevToken = getPrevToken();
                if (prevToken == '<!--') {
                    if (char == '>') {
                        let contents = flushCharBuffer(false);
                        if (contents.length >= 2 && contents.slice(-2) == '--') {
                            if (!tryPopToken('-->')) throw 'Pop token failed'; 
                            flushCharBuffer();
                            continue;
                        }
                    }
                    else {
                        bufferCharMaxLen(char, '--'.length);
                        // bufferCharacter(char)
                        continue;
                    }
                }
                else if (prevToken == '<!DOCTYPE') {

                }
                else if (prevToken == '<?') {
                    if (char == '>') {
                        let contents = flushCharBuffer();
                        if (contents.slice(-1) != '?') throw "Invalid <?xml ?> declaration format";
                        contents = contents.slice(0, -1);
                        const [_, attrs] = getTagAttrsFromStripped(contents);
                        console.log(attrs);
                        if (!tryPopToken('?>')) throw 'Pop token failed';
                        continue;
                    }
                    else {
                        bufferCharacter(char);
                        continue;
                    }
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
                    bufferCharacter(char);
                    const bufferContent = flushCharBuffer(false);
                    console.log("Buffer:", bufferContent);
                    if (bufferContent == '!--') {
                        console.log("Replacing top token");
                        replaceTopToken('<!--');
                        flushCharBuffer();
                        continue;
                    }
                    else if (bufferContent == '!DOCTYPE') {
                        replaceTopToken('<!DOCTYPE')
                        continue;
                    }

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