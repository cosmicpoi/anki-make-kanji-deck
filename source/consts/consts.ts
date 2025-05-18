export const k_GUESS_STRING = '(guess❓)';

export const k_CHARACTER_LIST_PATH: string = 'lists/characters';
export const k_JLPT_WORD_LIST_PATH: string = 'lists/jlpt_words_csv'

const k_DATA_DIR = "data";
const k_DATA = (s: string): string => k_DATA_DIR + "/" + s;

export const k_UNIHAN_DB_PATH: string = k_DATA('Unihan');
export const k_KANJIDIC_FILE_PATH: string = k_DATA('kanjidic2.xml');
export const k_HANZIDB_FILE_PATH: string = k_DATA('hanzi_db.csv');
export const k_CEDICT_FILE_PATH: string = k_DATA('cedict_ts.u8');
export const k_JMDICT_FILE_PATH: string = k_DATA('JMdict_e');
export const k_BCCWJ_FILE_PATH: string = k_DATA('BCCWJ_frequencylist_suw_ver1_0.tsv');
export const k_BCLU_FILE_PATH: string = k_DATA('bclu.txt');
export const k_SUBTLEX_FILE_PATH: string = k_DATA('SUBTLEX-CH-WF.csv');


export const k_HSK_FILE_LIST: string[] = [
    'HSK__1.txt',
    'HSK__2.txt',
    'HSK__3.txt',
    'HSK__4.txt',
    'HSK__5.txt',
    'HSK__6.txt',
    'HSK__7-9.txt' 
];

export const k_JLPT_FILE_LIST: string[] = [
    'JLPT__n5.txt',
    'JLPT__n4.txt',
    'JLPT__n3.txt',
    'JLPT__n2.txt',
    'JLPT__n1.txt',
];

export const k_JOYO_FILE_PATH = "Joyo_all.txt";
export const k_JINMEIYO_FILE_PATH ="Jinmeiyo.txt";

export const k_NUM_KANGXI_RADICALS = 214;