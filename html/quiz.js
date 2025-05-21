function kanaToRomaji(input) {
    const kanaMap = {
        // Hiragana & Katakana
        'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
        'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
        'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
        'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
        'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
        'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
        'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
        'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
        'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
        'わ': 'wa', 'を': 'o', 'ん': 'n',

        'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
        'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
        'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
        'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
        'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',

        'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
        'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
        'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
        'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
        'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
        'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
        'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',

        'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
        'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
        'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
        'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',

        // Katakana
        'ア': 'a', 'イ': 'i', 'ウ': 'u', 'エ': 'e', 'オ': 'o',
        'カ': 'ka', 'キ': 'ki', 'ク': 'ku', 'ケ': 'ke', 'コ': 'ko',
        'サ': 'sa', 'シ': 'shi', 'ス': 'su', 'セ': 'se', 'ソ': 'so',
        'タ': 'ta', 'チ': 'chi', 'ツ': 'tsu', 'テ': 'te', 'ト': 'to',
        'ナ': 'na', 'ニ': 'ni', 'ヌ': 'nu', 'ネ': 'ne', 'ノ': 'no',
        'ハ': 'ha', 'ヒ': 'hi', 'フ': 'fu', 'ヘ': 'he', 'ホ': 'ho',
        'マ': 'ma', 'ミ': 'mi', 'ム': 'mu', 'メ': 'me', 'モ': 'mo',
        'ヤ': 'ya', 'ユ': 'yu', 'ヨ': 'yo',
        'ラ': 'ra', 'リ': 'ri', 'ル': 'ru', 'レ': 're', 'ロ': 'ro',
        'ワ': 'wa', 'ヲ': 'o', 'ン': 'n',

        'ガ': 'ga', 'ギ': 'gi', 'グ': 'gu', 'ゲ': 'ge', 'ゴ': 'go',
        'ザ': 'za', 'ジ': 'ji', 'ズ': 'zu', 'ゼ': 'ze', 'ゾ': 'zo',
        'ダ': 'da', 'ヂ': 'ji', 'ヅ': 'zu', 'デ': 'de', 'ド': 'do',
        'バ': 'ba', 'ビ': 'bi', 'ブ': 'bu', 'ベ': 'be', 'ボ': 'bo',
        'パ': 'pa', 'ピ': 'pi', 'プ': 'pu', 'ペ': 'pe', 'ポ': 'po',

        'キャ': 'kya', 'キュ': 'kyu', 'キョ': 'kyo',
        'シャ': 'sha', 'シュ': 'shu', 'ショ': 'sho',
        'チャ': 'cha', 'チュ': 'chu', 'チョ': 'cho',
        'ニャ': 'nya', 'ニュ': 'nyu', 'ニョ': 'nyo',
        'ヒャ': 'hya', 'ヒュ': 'hyu', 'ヒョ': 'hyo',
        'ミャ': 'mya', 'ミュ': 'myu', 'ミョ': 'myo',
        'リャ': 'rya', 'リュ': 'ryu', 'リョ': 'ryo',

        'ギャ': 'gya', 'ギュ': 'gyu', 'ギョ': 'gyo',
        'ジャ': 'ja', 'ジュ': 'ju', 'ジョ': 'jo',
        'ビャ': 'bya', 'ビュ': 'byu', 'ビョ': 'byo',
        'ピャ': 'pya', 'ピュ': 'pyu', 'ピョ': 'pyo',
    };

    const sokuon = ['っ', 'ッ']; // small tsu
    const longVowel = 'ー';

    let result = '';
    let i = 0;

    while (i < input.length) {
        const twoChar = input.slice(i, i + 2);
        const oneChar = input[i];

        if (sokuon.includes(oneChar)) {
            const nextKana = input.slice(i + 1, i + 3);
            let romajiNext = kanaMap[nextKana] || kanaMap[input[i + 1]];
            if (romajiNext) result += romajiNext[0]; // double consonant
            i += 1;
        } else if (kanaMap[twoChar]) {
            result += kanaMap[twoChar];
            i += 2;
        } else if (kanaMap[oneChar]) {
            result += kanaMap[oneChar];
            i += 1;
        } else if (oneChar === longVowel) {
            // Repeat the last vowel from the current romaji result
            const lastVowel = result.match(/[aeiou]$/i);
            if (lastVowel) result += lastVowel[0]; // extend vowel
            i += 1;
        } else {
            result += oneChar; // fallback for unknown
            i += 1;
        }
    }

    return result;
}

function levenshteinDistance(a, b) {
    const matrix = [];

    // Ensure strings
    a = a.toLowerCase();
    b = b.toLowerCase();

    // Initialize the first row and column of the matrix
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b[i - 1] === a[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1]; // No change
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,    // Deletion
                    matrix[i][j - 1] + 1,    // Insertion
                    matrix[i - 1][j - 1] + 1 // Substitution
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

function kanaDist(a, b) {
    return levenshteinDistance(kanaToRomaji(a), kanaToRomaji(b));
}


function setupReadingQuiz(readingList, quizId, feedbackId, hintId) {
    const inputEl = document.getElementById(quizId);
    const feedbackEl = document.getElementById(feedbackId);
    const hintEl = document.getElementById(hintId);

    const readings = readingList.split(',').filter(s => s.length != 0);
    const correct = [];

    const getClosest = (text) => {
        let score = Infinity;
        let best = '';
        const remaining = readings.filter(e => !correct.includes(e));
        for (const r of remaining) {
            const sc = kanaDist(r, text);
            if (sc < score) {
                score = sc;
                best = r;
            }
        }
        return best;
    }

    const refreshFeedback = () => {
        const nums = correct.length.toString() + '/' + readings.length.toString();
        const correctStr = readings.filter(e => correct.includes(e)).join(', ');
        feedbackEl.innerHTML = nums + ': ' + correctStr;

        if (correct.length == readings.length) {
            feedbackEl.className = (feedbackEl.className || "") + " correct";
        }
    }

    let fails = 0;
    let currentHint = '';
    let hintIdx = 0;

    const refreshHint = () => {
        if (currentHint != '') {
            hintEl.innerHTML = "Hint: " + currentHint.substring(0, hintIdx + 1);
        }
        else {
            hintEl.innerHTML = '';
        }
    }

    const blink = () => {
        const ogClassName = inputEl.className;
        const newClassName = (ogClassName || "") + " fail";
        inputEl.className = newClassName;
        setTimeout(() => {inputEl.className = ogClassName;}, 100);
    }
    
    
    inputEl.addEventListener('keyup', (e => {
        if (e.key == 'Enter' || e.target.value.slice(-1).match(/\s|　/)) {
            if (correct.length == readings.length) return;
            const val = e.target.value.replace(/(\s|　)/g, '');
            e.target.value = val;
            if (readings.includes(val) && !correct.includes(val)) {
                correct.push(val);
                inputEl.value = '';
                currentHint = '';
                hintIdx = 0;
            }
            else {
                blink();
                fails++;
                if (fails >= 3) {
                    if (currentHint == '') {
                        currentHint = getClosest(val);
                        hintIdx = 0;
                    } else {
                        hintIdx++;
                    }
                }
            }
            refreshHint();
            refreshFeedback();
        }
        
    }));
    refreshFeedback();
    refreshHint();
}