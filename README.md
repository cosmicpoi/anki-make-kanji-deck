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
yarn ts-node generate_cards.ts -o myfile.txt
```

To generate all-character lists:
```
yarn ts-node generate-character-list.ts -c lists/Chinese_All.txt -j lists/Japanese_All.txt
```

To generated unnested word lists:
```
yarn ts-node generate_unnested_words.ts -i lists/words_raw_nested -o lists/words
```

To clean build folder:
```
yarn clean
```

## Sources
* HSK 1-6 character lists provided by [huamake.com](https://huamake.com/1to6Lists.htm) and 7-9 by [elkmovie/hsk30](https://github.com/elkmovie/hsk30/blob/main/charlist.txt)
* JLPT character lists provided by [kanshudo](https://www.kanshudo.com/collections/jlpt_kanji)
* JLPT word lists provided by [stephenmk/yomitan-jlpt-vocab](https://github.com/stephenmk/yomitan-jlpt-vocab/tree/main) and this [anki deck](https://ankiweb.net/shared/info/1550984460)
* [kanjidic2](https://www.edrdg.org/kanjidic/kanjd2index_legacy.html)
  * to confirm if a glyph is Japanese or Chinese, something not offered by the unicode API (which provides readings to both types of glyphs)
* [MBDG CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cedict)
  * to provide simplfied-traditional conversion
* The the [unihan](https://www.unicode.org/charts/unihan.html) database is used for chinese-japanese glyph conversion
* Download: `https://www.unicode.org/Public/UCD/latest/ucd/`. (`ucd/UniHan.zip`)


### Stroke order
Chinese (simplified and traditional) stroke order resolution is done through [Hanzi Writer](https://hanziwriter.org/) (provided via npm/yarn).

Japanese stroke order is provided through (kanjivg)[https://github.com/KanjiVG/kanjivg].

## Glyph conversion

Trad/Simplified chinese conversion is done using CEDICT. For Chinese-Japanese we construct a candidate list using unihan's `kSemanticVariant` and `kSpecializedSemanticVariant` fields, then use Kanjidic2 to confirm which glyphs are actually Japanese (because sometimes historical and korean glyphs are included).




## Brainstorm
In the long run, I'd like to develop a **richly-connected**, ai-assisted, relational database of Chinese/Japanese characters, vocab, grammar, and sentences.

For instance, I'd like to be able to do this:
```
learn 僕はいちごが欲しいです
characters: 僕, 欲
words: 僕,は,いちご,が,欲しい,です
grammar: AはYです
```
You could tell the system to learn a single sentence, and it would dynamically update all of the databases with the corresponding information in a linked way. So it would note that you have also learned the character, word, and grammar point, and would also relationally connect all of that data together.

It could also work in the other direction: you learn a single character, it propagates out to words and sentences, and those are registered in the system.


## TODO:
* Stroke order
* CN/Kun/ON vocab lookup
* Sentence example generation
* Vocab card generation
* Integrate "usually_kana" and other tags