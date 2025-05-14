import * as fs from 'fs'
import * as readline from 'readline';

import autoBind from "auto-bind";
import { log_v } from './logging';
import { Bclu } from './Bclu';
import { k_HANZIDB_FILE_PATH, k_KANJIDIC_FILE_PATH, k_NUM_KANGXI_RADICALS, k_UNIHAN_DB_PATH } from './consts';
import { Kanjidic } from './kanjidic';
import { Hanzidb } from './Hanzidb';
import { areRadicalStrokesClose, Unihan } from './unihan';
import { isHanCharacter  } from './types';

async function doThing() {
    const unihan = await Unihan.create(k_UNIHAN_DB_PATH);

    console.log(unihan.getClusterById(unihan.getClusterId('楽')));

}
doThing()