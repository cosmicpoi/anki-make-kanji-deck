"use strict";
var furigana = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // source/utils/furigana.ts
  var furigana_exports = {};
  __export(furigana_exports, {
    generateFurigana: () => generateFurigana,
    generatePinyinRuby: () => generatePinyinRuby,
    generateRuby: () => generateRuby,
    removeBracketed: () => removeBracketed,
    removeBracketedForId: () => removeBracketedForId,
    removeBracketedForIds: () => removeBracketedForIds,
    replaceRubyForId: () => replaceRubyForId,
    replaceRubyForIds: () => replaceRubyForIds,
    replaceWithRuby: () => replaceWithRuby
  });

  // source/consts/consts.ts
  var k_DATA_DIR = "data";
  var k_DATA = (s) => k_DATA_DIR + "/" + s;
  var k_UNIHAN_DB_PATH = k_DATA("Unihan");
  var k_KANJIDIC_FILE_PATH = k_DATA("kanjidic2.xml");
  var k_HANZIDB_FILE_PATH = k_DATA("hanzi_db.csv");
  var k_CEDICT_FILE_PATH = k_DATA("cedict_ts.u8");
  var k_JMDICT_FILE_PATH = k_DATA("JMdict_e");
  var k_BCCWJ_FILE_PATH = k_DATA("BCCWJ_frequencylist_suw_ver1_0.tsv");
  var k_BCLU_FILE_PATH = k_DATA("bclu.txt");
  var k_SUBTLEX_FILE_PATH = k_DATA("SUBTLEX-CH-WF.csv");

  // source/types.ts
  var k_UNICODE_HAN_BOUNDS = [
    // CJK Unified Ideographs Extension A (U+3400 through U+4DBF)
    [13312, 19903],
    // CJK Unified Ideographs (U+4E00 through U+9FFF)
    [19968, 40959],
    // CJK Compatibility Ideographs (U+F900 through U+FAD9)
    [63744, 64217],
    // CJK Unified Ideographs Extension B (U+20000 through U+2A6DF)
    // CJK Unified Ideographs Extension C (U+2A700 through U+2B739)
    // CJK Unified Ideographs Extension D (U+2B740 through U+2B81D)
    // CJK Unified Ideographs Extension E (U+2B820 through U+2CEA1)
    // CJK Unified Ideographs Extension F (U+2CEB0 through U+2EBE0)
    // CJK Unified Ideographs Extension I (U+2EBF0 through U+2EE5D)
    [131072, 173791],
    // CJK Compatibility Ideographs Supplement (U+2F800 through U+2FA1D)
    [194560, 195101],
    // CJK Unified Ideographs Extension G (U+30000 through U+3134A)
    // CJK Unified Ideographs Extension H (U+31350 through U+323AF)
    [196608, 205743]
  ];
  function isHanCharacter(char) {
    const code = char.charCodeAt(0);
    for (const tup of k_UNICODE_HAN_BOUNDS) {
      if (code >= tup[0] && code < tup[1]) return true;
    }
    return false;
  }
  function isHiragana(char) {
    const code = char.codePointAt(0);
    return code !== void 0 && code >= 12352 && code <= 12447;
  }
  function isKatakana(char) {
    const code = char.codePointAt(0);
    return code !== void 0 && (code >= 12448 && code <= 12543 || // Katakana block
    code >= 12784 && code <= 12799);
  }
  function isKana(char) {
    const exclusions = ["\u30FB", "\u30FD", "\u30FE", "\u30FF", "\u3099", "\u309A", "\u309B", "\u309C", "\u309D", "\u309E", "\u309F"];
    return (isHiragana(char) || isKatakana(char)) && !exclusions.includes(char);
  }

  // source/utils/furigana.ts
  function isStrKatakana(input) {
    return input.split("").every(isKana);
  }
  function katakanaToHiragana(input) {
    return input.replace(/[\u30A1-\u30F6]/g, (char) => {
      const code = char.charCodeAt(0);
      return String.fromCharCode(code - 96);
    });
  }
  var isSmallChar = (c) => ["\u3083", "\u3085", "\u3087"].includes(c);
  var isKanjiLike = (c) => isHanCharacter(c) || c == "\u3005" || c == "\u30F6";
  function isStrKanjiOrKana(s) {
    if (s.length == 0) console.error("WARNING: Got an empty string in isStrKanjiOrKana, vacuously true");
    return s.split("").every((c) => isKanjiLike(c) || isKana(c));
  }
  function generateFurigana(kanjiReading, hiragana, padKana = true) {
    function _generateFurigana(kanjiChars, hiraganaChars) {
      const areAligned = (kanji, kana) => {
        if (kana == hiraganaChars.length || kanji == kanjiChars.length) return false;
        const kanjiChar = kanjiChars[kanji];
        const kanaChar = hiraganaChars[kana];
        if (!isKana(kanjiChar)) return false;
        return katakanaToHiragana(kanjiChar) == katakanaToHiragana(kanaChar);
      };
      const earlyReturn = () => {
        let kanjiStart = 0;
        let kanaStart = 0;
        while (kanjiStart < kanjiChars.length && !isStrKanjiOrKana(kanjiChars[kanjiStart])) {
          kanjiStart++;
        }
        while (kanaStart < hiraganaChars.length && !isStrKanjiOrKana(hiraganaChars[kanaStart])) {
          kanaStart++;
        }
        if (kanjiStart != 0 || kanaStart != 0) {
          if (kanjiStart == kanjiChars.length) {
            kanjiStart = 0;
          }
          if (kanaStart == hiraganaChars.length) {
            kanaStart = 0;
          }
          if (kanjiStart == 0 && kanaStart == 0)
            return [[kanjiChars.join(""), hiraganaChars.join("")]];
          else return [
            [kanjiChars.slice(0, kanjiStart).join(""), hiraganaChars.slice(0, kanaStart).join("")],
            ..._generateFurigana(kanjiChars.slice(kanjiStart), hiraganaChars.slice(kanaStart))
          ];
        }
        let kanjiEnd = 0;
        let kanaEnd = 0;
        while (kanjiEnd < kanjiChars.length && isStrKanjiOrKana(kanjiChars[kanjiEnd])) {
          kanjiEnd++;
        }
        while (kanaEnd < hiraganaChars.length && isStrKanjiOrKana(hiraganaChars[kanaEnd])) {
          kanaEnd++;
        }
        return [
          [kanjiChars.slice(0, kanjiEnd).join(""), hiraganaChars.slice(0, kanaEnd).join("")],
          ..._generateFurigana(kanjiChars.slice(kanjiEnd), hiraganaChars.slice(kanaEnd))
        ];
      };
      if (kanjiChars.length == 0 && hiraganaChars.length == 0) return [];
      if (!isStrKanjiOrKana(kanjiChars[0]) || !isStrKanjiOrKana(hiraganaChars[0])) {
        return earlyReturn();
      }
      if (isKana(kanjiChars[0]) && isKana(hiraganaChars[0])) {
        if (!areAligned(0, 0)) throw "Tried to render invalid furigana";
        let kanaEnd = 0;
        let kanjiEnd = 0;
        while (kanaEnd <= hiraganaChars.length && kanjiEnd <= kanjiChars.length && areAligned(kanaEnd, kanjiEnd)) {
          kanjiEnd++;
          kanaEnd++;
        }
        const seq = [
          kanjiChars.slice(0, kanjiEnd).join(""),
          hiraganaChars.slice(0, kanaEnd).join("")
        ];
        return [
          seq,
          ..._generateFurigana(
            kanjiChars.slice(kanjiEnd),
            hiraganaChars.slice(kanaEnd)
          )
        ];
      } else if (isKana(kanjiChars[kanjiChars.length - 1]) && isKana(hiraganaChars[hiraganaChars.length - 1]) && areAligned(kanjiChars.length - 1, hiraganaChars.length - 1)) {
        let kanaStart = hiraganaChars.length;
        let kanjiStart = kanjiChars.length;
        while (kanaStart >= 0 && kanjiStart >= 0 && areAligned(kanjiStart - 1, kanaStart - 1)) {
          kanaStart--;
          kanjiStart--;
        }
        const seq = [
          kanjiChars.slice(kanjiStart, kanjiChars.length).join(""),
          hiraganaChars.slice(kanaStart, hiraganaChars.length).join("")
        ];
        return [
          ..._generateFurigana(
            kanjiChars.slice(0, kanjiStart),
            hiraganaChars.slice(0, kanaStart)
          ),
          seq
        ];
      } else {
        if (!(isKanjiLike(kanjiChars[0]) && isKana(hiraganaChars[0]))) {
          if (isStrKanjiOrKana(kanjiChars[0]) || isStrKanjiOrKana(hiraganaChars[0])) {
            console.error(kanjiChars, hiraganaChars);
            throw "Invalid sequence alignment";
          }
        }
        if (kanjiChars.every(isKanjiLike)) {
          return [[kanjiChars.join(""), hiraganaChars.join("")]];
        }
        let kanjiEnd = 0;
        while (kanjiEnd < kanjiChars.length && isKanjiLike(kanjiChars[kanjiEnd])) {
          kanjiEnd++;
        }
        let kanjiNextKanaEnd = kanjiEnd;
        while (kanjiNextKanaEnd < kanjiChars.length && isKana(kanjiChars[kanjiNextKanaEnd])) {
          kanjiNextKanaEnd++;
        }
        if (kanjiNextKanaEnd == kanjiEnd) {
          return [[kanjiChars.join(""), hiraganaChars.join("")]];
        }
        const nextKanaSeq = kanjiChars.slice(kanjiEnd, kanjiNextKanaEnd).join("");
        let kanaNextStartCandidates = [];
        for (let i = 1; i + nextKanaSeq.length <= hiraganaChars.length; i++) {
          if (!isKana(hiraganaChars[i])) break;
          if (hiraganaChars.slice(i, i + nextKanaSeq.length).join("") == nextKanaSeq) {
            kanaNextStartCandidates.push(i);
          }
        }
        if (kanaNextStartCandidates.length == 0) {
          console.error("ERROR: Seems to be an incorrect reading.", kanjiReading, hiragana, kanjiChars, hiraganaChars);
          return [[kanjiChars.join(""), hiraganaChars.join("")]];
        }
        if (!isSmallChar(nextKanaSeq.slice(-1))) {
          kanaNextStartCandidates = kanaNextStartCandidates.filter((idx) => {
            return !isSmallChar(hiraganaChars[idx + nextKanaSeq.length]);
          });
        }
        if (kanaNextStartCandidates.length == 2) {
          const ogCandidates = [...kanaNextStartCandidates];
          kanaNextStartCandidates = kanaNextStartCandidates.filter((idx) => {
            if (idx == hiraganaChars.length - 1 && kanjiNextKanaEnd != kanjiChars.length)
              return false;
            return true;
          });
          const kanjiCandidates = [];
          for (let i = kanjiEnd; i + nextKanaSeq.length <= kanjiChars.length; i++) {
            if (!isKana(hiraganaChars[i])) break;
            if (kanjiChars.slice(i, i + nextKanaSeq.length).join("") == nextKanaSeq) {
              kanjiCandidates.push(i);
            }
          }
          if (kanjiCandidates.length == kanaNextStartCandidates.length) {
            kanaNextStartCandidates = [kanaNextStartCandidates[0]];
          }
          const maxCandidateStart = hiraganaChars.length - (kanjiChars.length - kanjiNextKanaEnd) - 1;
          const trimmed = [...ogCandidates].filter((idx) => idx <= maxCandidateStart);
          if (trimmed.length == 1) {
            kanaNextStartCandidates = trimmed;
          }
          if (kanaNextStartCandidates.length > 1) {
            return earlyReturn();
          }
        }
        const kanaEnd = kanaNextStartCandidates[0];
        const seq = [kanjiChars.slice(0, kanjiEnd).join(""), hiraganaChars.slice(0, kanaEnd).join("")];
        return [
          seq,
          ..._generateFurigana(kanjiChars.slice(kanjiEnd), hiraganaChars.slice(kanaEnd))
        ];
      }
    }
    const readings = _generateFurigana(kanjiReading.split(""), hiragana.split(""));
    return readings.map(([s1, s2]) => {
      if (!isStrKanjiOrKana(s1) || !isStrKanjiOrKana(s2)) {
        const isGrammar = (s) => s == "" || !isStrKanjiOrKana(s);
        if (!(isGrammar(s1) && isGrammar(s2))) {
          console.log(`t1:"${s1}", t2:"${s2}"`);
          throw "Invalid token";
        }
        if (s1 != "" && s2 != "" && s1 != s2) console.log("WARNING: weird reading", kanjiReading, hiragana, "|", s1, s2);
        return s1;
      } else {
        let isSingle = false;
        if (isStrKatakana(s1) && katakanaToHiragana(s1) == s2) {
          isSingle = true;
        }
        if (s1 == s2) {
          isSingle = true;
        }
        if (!isSingle) {
          return `${s1}[${s2}]`;
        } else {
          return padKana ? `${s1}[ ]` : s1;
        }
      }
    }).join("");
  }
  function generateRuby(kanjiReading, hiragana) {
    const reading = generateFurigana(kanjiReading, hiragana);
    return `<ruby>${reading.replace(/\[/g, "<rt>").replace(/\]/g, "</rt>")}</ruby>`;
  }
  function generatePinyinRuby(kanji, pinyin) {
    const pinyinParts = pinyin.split(" ");
    const content = kanji.split("").map((c, i) => `${c}<rt>${pinyinParts[i]}</rt>`).join("");
    return `<ruby>${content}</ruby>`;
  }
  var furiganaRegexp = new RegExp(/((\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|ー)+?)\[(.*?)\]/gu);
  function replaceWithRuby(source) {
    return source.replace(furiganaRegexp, (m) => {
      const parts = m.split("[");
      const chars = parts[0];
      const reading = parts[1].slice(0, -1);
      if (reading.replace(/\s/g, "") == "") return `<ruby>${chars}</ruby>`;
      if (isKana(reading.substring(0, 1))) return generateRuby(chars, reading);
      else return generatePinyinRuby(chars, reading);
    });
  }
  function replaceRubyForId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = replaceWithRuby(el.innerHTML);
  }
  function replaceRubyForIds(...id) {
    [...id].forEach((s) => replaceRubyForId(s));
  }
  function removeBracketed(source) {
    return source.replace(furiganaRegexp, (m) => m.split("[")[0]);
  }
  function removeBracketedForId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = removeBracketed(el.innerHTML);
  }
  function removeBracketedForIds(...id) {
    [...id].forEach((s) => removeBracketedForId(s));
  }
  return __toCommonJS(furigana_exports);
})();
