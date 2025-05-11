import { k_JMDICT_FILE_PATH } from "./consts";
import { Jmdict } from "./jmdict";

async function doThing() {
    const jmdict = await Jmdict.create(k_JMDICT_FILE_PATH);
    if (!jmdict) return;
    jmdict.doThing();
}

doThing();