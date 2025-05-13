import * as fs from 'fs'
import * as readline from 'readline';

import autoBind from "auto-bind";
import { log_v } from './logging';
import { Bclu } from './Bclu';
import { k_KANJIDIC_FILE_PATH } from './consts';
import { Kanjidic } from './kanjidic';

async function doThing() {
    const kanjidic = await Kanjidic.create(k_KANJIDIC_FILE_PATH);
    
}
doThing()