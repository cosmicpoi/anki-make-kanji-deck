# anki-make-kanji-deck

This script is aimed at English native speakers who are seeking to study Chinese and Japanese simultaneously.

## Setup

To set up repo:
```
git clone https://github.com/KanjiVG/kanjivg.git
yarn install
```

Also, download `Unihan.zip` ([latest](https://www.unicode.org/Public/UCD/latest/ucd/)) and extract it to `Unihan/` in the root folder.

## Running
To run script:
```
yarn execute -o myfile.txt
```

To clean build folder:
```
yarn clean
```

## Sources


### Stroke order
Chinese (simplified and traditional) stroke order resolution is done through [Hanzi Writer](https://hanziwriter.org/) (provided via npm/yarn).

Japanese stroke order is provided through (kanjivg)[https://github.com/KanjiVG/kanjivg].

### Word lists
HSK word lists provided by [huamake.com](https://huamake.com/1to6Lists.htm) and [elkmovie/hsk30](https://github.com/elkmovie/hsk30/blob/main/charlist.txt)

JLPT lists provided by [kanshudo](https://www.kanshudo.com/collections/jlpt_kanji)

We also use [kanjidic2](https://www.edrdg.org/kanjidic/kanjd2index_legacy.html) to differentiate if a glyph is Japanese or not, something not offered by the unicode API

### UniHan Database
The the [unihan](https://www.unicode.org/charts/unihan.html) database is an extremely helpful resource that provides us with **character equivalence**, **pinyin/onyomi/kunyomi readings**, among other things.

* ([Github repo]((https://github.com/unicode-org/unihan-database)))
* ([unicode report](https://www.unicode.org/reports/tr38/))
* Download: `https://www.unicode.org/Public/UCD/latest/ucd/`. (`ucd/UniHan.zip`)

If a link between two characters is determined in `kSimplifiedVariant`, `kTraditionalVariant`, `kSemanticVariant`, or `kSpecializedSemanticVariant`, the characters are merged.

Readings are obtained from `kJapanese`, `kJapaneseKun`, `kJapaneseOn`, `kMandarin`.

## TODO:
* Derive english meanings using jmdict/unihan
* Integrate multiple dictionary sources for better data (JMDict, Kanjidic)