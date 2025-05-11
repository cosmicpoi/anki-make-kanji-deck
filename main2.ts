import * as fs from 'fs'
import { k_JMDICT_FILE_PATH } from "./consts";
import { Jmdict } from "./jmdict";
import * as xmlparser from './xmlparser';
import { ParamXMLElement, ParamXMLParserHandlerObj } from './xmlparser';

type JmdictAttrKey = {
    'xml:lang': 'xml:lang';
};

type JmdictTagType = {
    r_ele: 'r_ele';
    k_ele: 'k_ele';
    sense: 'sense';
    entry: 'entry';
    ent_seq: 'ent_seq';
    keb: 'keb';
    reb: 'reb';
    pos: 'pos';
    gloss: 'gloss';
};

type JmdictElement = ParamXMLElement<keyof JmdictTagType, keyof JmdictAttrKey>;

type JmEntSeq = JmdictElement & {
    tagName: 'ent_seq'
    children: [number];
};
type JmKeb = JmdictElement & {
    tagName: 'keb',
    children: [string];
};
type JmKepri = JmdictElement & {
    tagName: 'ke_pri'
    children: [string];
};
type JmKele = JmdictElement & {
    tagName: 'k_ele',
    children: (JmKeb | JmKepri)[]
};
type JmRele = JmdictElement & {
    tagName: 'r_ele',
    children: (JmKeb | JmKepri)[]
};
type JmGloss = JmdictElement & {
    tagName: 'gloss',
    children: [string]
};
type JmPos = JmdictElement & {
    tagName: 'pos',
    children: [string]
};
type JmMisc = JmdictElement & {
    tagName: 'pos',
    children: [string]
};
type JmSense = JmdictElement & {
    tagName: 'pos',
    children: (JmGloss | JmMisc | JmPos)[]
};
type JmEntry = JmdictElement & {
    tagName: 'entry',
    children: (JmEntSeq | JmKele | JmRele | JmSense)[],
};


async function doThing() {

    const onEntry = (el: JmdictElement) => {
        const entry = el as JmEntry;
        // console.log(entry);
    };

    const handlers: ParamXMLParserHandlerObj<keyof JmdictTagType, keyof JmdictAttrKey> = {
        elements: { 'entry': onEntry },
    };

    // k_JMDICT_FILE_PATH
    await xmlparser.parseXML<keyof JmdictTagType, keyof JmdictAttrKey>('test_xml.xml', handlers);

    // const jmdict = await Jmdict.create(k_JMDICT_FILE_PATH);
    // if (!jmdict) return;

    // const filepath = 'output/test_all_japanese_words.txt';
    // const writeStream = fs.createWriteStream(filepath, { flags: 'w', encoding: 'utf8' });
    // jmdict.forEachWord((w) => {
    //     // console.log(w);
    //     const ok = writeStream.write(w + '\n');

    //     if (!ok) {
    //         // Stream buffer is full, wait for drain before continuing
    //         writeStream.once('drain', () => {
    //             console.log('Drain event triggered, resuming writes...');
    //         });
    //     }
    // });

    // writeStream.end(() => {
    //     console.log('Finished writing file.', filepath);
    // });
}

doThing();