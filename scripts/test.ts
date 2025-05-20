import { Bccwj } from 'Bccwj';
import { k_BCCWJ_FILE_PATH, k_HANZIDB_FILE_PATH } from 'consts/consts';
import { Hanzidb } from 'Hanzidb';
import * as generateFurigana from 'utils/furigana';

async function doThing() {
    const hanzidb = await Hanzidb.create(k_HANZIDB_FILE_PATH);
    // console.log(bccwj.getFrequencyRank('中々'));
}

doThing();