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
yarn execute execute/generate_cards.ts -o output/myfile.txt
```

To clean build folder:
```
yarn clean
```

## Scripts
To bundle `furigana` lib:

```
yarn esbuild source/utils/furigana.ts --bundle --format=iife --global-name=furigana --outfile=furigana.bundle.js
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
* [BCLU Chinese Corpus](https://www.plecoforums.com/threads/word-frequency-list-based-on-a-15-billion-character-corpus-bcc-blcu-chinese-corpus.5859/)
* [Hanzidb](https://github.com/ruddfawcett/hanziDB.csv/tree/master/data)


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

To look for potential duplicates in output:
```
CN first:
(^Character Sino-Japanese\t\t([^\s])\t([^\s])\t(.+?)\t.+\nCharacter Sino-Japanese\t([^\s])\t\t\t\4.+$)
JP first:
(^Character Sino-Japanese\t([^\s])\t\t\t(.+?)\t.+\nCharacter Sino-Japanese\t\t([^\s])\t([^\s])\t\3.+$)



Without backref:
(^Character Sino-Japanese\t\t([^\s])\t([^\s])\t(.+?)\t.+\nCharacter Sino-Japanese\t[^\s]\t\t\t.+$)

(^Character Sino-Japanese\t[^\s]\t\t\t.+\nCharacter Sino-Japanese\t\t([^\s])\t([^\s])\t(.+?)\t.+$)
```


## TODO:

Easy, high-value
* Integrate "usually_kana", "archaic", and other tags ()
  * rare - rare term
  * pol - teneigo
  * hon - sonkeigo
  * hum - kenjougo
  * rK - rarely used kanji
  * sK - search-only kanji
  * ik - irregular kana
  * iK - irregular kanji
  * io - irregular okurigana
  * oK - outdated kanji
  * m-sl - manga slang
  * joc - humorous term
  * obs - obselete term
  * on-mim - mimetic term
  * sl - slang
* Vocab card generation
  * Integrate part of speech

Hard, high-value  
* Write up or publish results somehow
* Sentence example generation

Hard, low-value
* Generate radical breakdown
* Generate furigana (kanji only - hard )

Easy, low-value
* Optimize XML parser