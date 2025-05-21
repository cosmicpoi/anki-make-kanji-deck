function createMultiHanzi(id, charsStr) {
    const chars = charsStr.replace(/\[.+?\]/g, '').split(',').filter(s => s.length != 0);
    let idx = 0;

    var writer = HanziWriter.create('character-target-div', chars[idx], {
        padding: 5
    });

    const paragraph = document.createElement("p");
    const update = () => {
        // Update paragraph
        paragraph.innerHTML = chars.map((c, i) => i == idx ? `[${c}]` : c).join(' ');
        // Update anim
        writer.setCharacter(chars[idx]);
        writer.loopCharacterAnimation();
    }

    // Find the target <div> by ID
    const targetDiv = document.getElementById(id);
    if (targetDiv) {
        targetDiv.appendChild(paragraph);
    }

    targetDiv.addEventListener('click', () => {
        idx = (idx + 1) % chars.length;
        update();
    });

    update();
}

