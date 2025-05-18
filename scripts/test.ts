import { Bccwj } from "Bccwj";
import { k_BCCWJ_FILE_PATH, k_CEDICT_FILE_PATH, k_UNIHAN_DB_PATH } from "consts/consts";
import { Cedict } from "modules/Cedict";
import { isHanCharacters } from "types";
import { Unihan } from "Unihan";

function isSinoJpVocab(
    unihan: Unihan,
    jp: string,
    cn: string,
): boolean {
    if (!isHanCharacters(jp)) return false;
    if (jp.length != cn.length) return false;

    for (let k = 0; k < jp.length; k++) {
        const jp_c = jp.at(k);
        const cn_c = cn.at(k);
        if (!jp_c || !cn_c) {
            return false;
        }
        if (!unihan.hasLink(jp_c, cn_c)) {
            return false;
        }
    }
    return true;
}

async function doThing() {
    const unihan = await Unihan.create(k_UNIHAN_DB_PATH);
    // const bccwj = await Bccwj.create(k_BCCWJ_FILE_PATH);
    const cedict = await Cedict.create(k_CEDICT_FILE_PATH);
    // console.log(bccwj.getNMostFrequentChars(3000));
    console.log(cedict.getVocabEntriesForChar('白').filter(e => e.simplified == '告白'));
}

doThing();