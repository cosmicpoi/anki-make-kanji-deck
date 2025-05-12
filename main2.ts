import * as fs from 'fs'
import { k_JMDICT_FILE_PATH } from "./consts";
import { Jmdict } from "./jmdict";
import * as xmlparser from './xmlparser';
import { ParamXMLElement, XMLParserProps, XMLDtdDecl } from './xmlparser';



async function doThing() {
    const jmdict: Jmdict = await Jmdict.create(k_JMDICT_FILE_PATH);
    
    jmdict.forEachWord((w) => console.log(w)); 
}

doThing();
// console.log(splitAroundBoundaries('ELEMENT entry            "ent_seq, k_ele*, r_ele+, sense+"'));