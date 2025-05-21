function createDrawingCanvas(canvasId, clearId) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    const clearBtn = document.getElementById(clearId);

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    ctx.fillStyle = "black";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;

    let isDrawing = false;

    let paths = [];
    const loop = () => {
        for (const path of paths) {
            ctx.beginPath();
            ctx.moveTo(path[0][0], path[0][1]);
            
            for (let i = 1; i < path.length; i++) {
                ctx.lineTo(path[i][0], path[i][1]);
                ctx.moveTo(path[i][0], path[i][1]);
            }
            ctx.stroke();
        }
        window.requestAnimationFrame(loop);
    }
    window.requestAnimationFrame(loop);

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

        isDrawing = true;
        paths.push([[x, y]]);
    });
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (isDrawing) {
            paths[paths.length - 1].push([x, y])
        }
    })
    canvas.addEventListener('mouseup', () => {
        console.log(paths);
        isDrawing = false;
    })
    clearBtn.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    });
}