const GRID_SIZE = 5;
const CANVAS_WIDTH = 1940;
const CANVAS_HEIGHT = 1564;

class PixelEditor {
    constructor() {
        this.canvas = document.getElementById('draw-canvas');
        this.gridCanvas = document.getElementById('grid-canvas');
        this.backgroundCanvas = document.getElementById('background-canvas');
        this.cursorPreview = document.getElementById('cursor-preview');
        
        // Создаем временный canvas для перемещаемой области
        this.tempCanvas = document.createElement('canvas');
        this.tempCanvas.width = CANVAS_WIDTH;
        this.tempCanvas.height = CANVAS_HEIGHT;
        this.tempCanvas.style.position = 'absolute';
        this.tempCanvas.style.top = '0';
        this.tempCanvas.style.left = '0';
        this.tempCanvas.style.pointerEvents = 'none';
        this.tempCanvas.style.display = 'none';
        document.getElementById('canvas-container').appendChild(this.tempCanvas);
        this.tempCtx = this.tempCanvas.getContext('2d');
        
        // Создаем временный canvas для сохранения/копирования
        this.exportCanvas = document.createElement('canvas');
        this.exportCanvas.width = CANVAS_WIDTH;
        this.exportCanvas.height = CANVAS_HEIGHT;
        this.exportCtx = this.exportCanvas.getContext('2d');
        
        this.ctx = this.canvas.getContext('2d');
        this.gridCtx = this.gridCanvas.getContext('2d');
        this.backgroundCtx = this.backgroundCanvas.getContext('2d');
        
        this.setupCanvas();
        this.setupEventListeners();
        this.setupTools();
        
        this.currentTool = 'rectangle';
        this.currentColor = '#000000';
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        this.isDragging = false;
        this.lastPos = { x: 0, y: 0 };
        this.history = [];
        this.currentStep = -1;
        
        this.backgroundImage = null;
        this.loadBackground();
        this.drawGrid();
    }
    
    setupCanvas() {
        [this.canvas, this.gridCanvas, this.backgroundCanvas].forEach(canvas => {
            canvas.width = CANVAS_WIDTH;
            canvas.height = CANVAS_HEIGHT;
        });
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        this.canvas.addEventListener('mousemove', this.updateCursorPreview.bind(this));
        
        // Обработчики для модального окна справки
        const helpModal = document.getElementById('helpModal');
        const helpButton = document.querySelector('.help-button');
        const closeButton = document.querySelector('.modal-close');
        
        helpButton.addEventListener('click', () => {
            helpModal.style.display = 'block';
        });
        
        closeButton.addEventListener('click', () => {
            helpModal.style.display = 'none';
        });
        
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                helpModal.style.display = 'none';
            }
        });
        
        // Обработчики для кнопок цветов
        document.querySelectorAll('.color-button').forEach(button => {
            button.addEventListener('click', (e) => {
                // Убираем активный класс у всех кнопок
                document.querySelectorAll('.color-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                // Добавляем активный класс нажатой кнопке
                e.target.classList.add('active');
                // Устанавливаем выбранный цвет
                this.currentColor = e.target.dataset.color;
            });
        });
        
        document.getElementById('save').addEventListener('click', this.saveImage.bind(this));
        document.getElementById('clear').addEventListener('click', this.clearCanvas.bind(this));
        document.getElementById('copy').addEventListener('click', this.copyToClipboard.bind(this));
        document.getElementById('undo').addEventListener('click', this.undo.bind(this));
    }
    
    setupTools() {
        ['move', 'rectangle', 'eraser'].forEach(tool => {
            document.getElementById(tool).addEventListener('click', () => {
                this.currentTool = tool;
                document.querySelectorAll('.toolbar button').forEach(btn => {
                    btn.classList.remove('active');
                });
                document.getElementById(tool).classList.add('active');
                
                // Устанавливаем стиль курсора
                this.canvas.style.cursor = tool === 'move' ? 'crosshair' : 
                                         tool === 'eraser' ? 'none' : 'default';
            });
        });
    }
    
    loadBackground() {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = 'background.png';
        img.onload = () => {
            this.backgroundImage = img;
            this.backgroundCtx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        };
        img.onerror = () => {
            console.error('Ошибка загрузки фонового изображения');
        };
    }
    
    drawGrid() {
        this.gridCtx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        this.gridCtx.lineWidth = 1;
        
        for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
            this.gridCtx.beginPath();
            this.gridCtx.moveTo(x, 0);
            this.gridCtx.lineTo(x, CANVAS_HEIGHT);
            this.gridCtx.stroke();
        }
        
        for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
            this.gridCtx.beginPath();
            this.gridCtx.moveTo(0, y);
            this.gridCtx.lineTo(CANVAS_WIDTH, y);
            this.gridCtx.stroke();
        }
    }
    
    getGridPosition(x, y) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const gridX = Math.floor((x - rect.left) / (GRID_SIZE * this.scale));
        const gridY = Math.floor((y - rect.top) / (GRID_SIZE * this.scale));
        
        return { x: gridX, y: gridY };
    }
    
    handleMouseMove(e) {
        if (e.buttons === 4) { // Средняя кнопка мыши удержана
            const rect = this.canvas.getBoundingClientRect();
            const container = document.getElementById('canvas-container');
            const containerRect = container.getBoundingClientRect();
            
            // Вычисляем размеры масштабированного изображения
            const scaledWidth = CANVAS_WIDTH * this.scale;
            const scaledHeight = CANVAS_HEIGHT * this.scale;
            
            // Вычисляем смещение курсора
            const dx = e.clientX - this.lastPos.x;
            const dy = e.clientY - this.lastPos.y;
            
            // Вычисляем новые координаты
            let newOffsetX = this.offset.x + dx;
            let newOffsetY = this.offset.y + dy;
            
            // Определяем максимальное смещение (90% от размера)
            const maxOverflowX = scaledWidth * 0.9;
            const maxOverflowY = scaledHeight * 0.9;
            
            // Определяем ограничения в зависимости от размеров
            if (scaledWidth <= containerRect.width) {
                // Если изображение меньше контейнера, позволяем ограниченное смещение
                newOffsetX = Math.max(-maxOverflowX, Math.min(maxOverflowX, newOffsetX));
            } else {
                // Если изображение больше контейнера, ограничиваем смещение
                const minX = containerRect.width - scaledWidth - maxOverflowX;
                const maxX = maxOverflowX;
                newOffsetX = Math.max(minX, Math.min(maxX, newOffsetX));
            }
            
            if (scaledHeight <= containerRect.height) {
                // Если изображение меньше контейнера, позволяем ограниченное смещение
                newOffsetY = Math.max(-maxOverflowY, Math.min(maxOverflowY, newOffsetY));
            } else {
                // Если изображение больше контейнера, ограничиваем смещение
                const minY = containerRect.height - scaledHeight - maxOverflowY;
                const maxY = maxOverflowY;
                newOffsetY = Math.max(minY, Math.min(maxY, newOffsetY));
            }
            
            // Применяем новые координаты
            this.offset.x = newOffsetX;
            this.offset.y = newOffsetY;
            
            this.lastPos = { x: e.clientX, y: e.clientY };
            this.updateCanvas();
        } else if (this.isDragging && this.currentTool === 'move' && this.draggingArea) {
            const pos = this.getGridPosition(e.clientX, e.clientY);
            const dx = pos.x - this.lastPos.x;
            const dy = pos.y - this.lastPos.y;
            
            // Проверяем, не вышла ли область за пределы холста
            const newPixels = this.draggingArea.pixels.map(pixel => ({
                x: pixel.x + dx,
                y: pixel.y + dy
            }));
            
            if (this.isAreaInBounds(newPixels)) {
                // Очищаем временный canvas
                this.tempCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                
                // Обновляем позиции пикселей в draggingArea
                this.draggingArea.pixels = newPixels;
                
                // Рисуем область на временном canvas
                this.drawAreaOnCanvas(this.tempCtx, this.draggingArea.pixels, this.draggingArea.color);
                
                // Показываем временный canvas
                this.tempCanvas.style.display = 'block';
                this.tempCanvas.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
                
                this.lastPos = pos;
            }
        }
    }
    
    handleMouseDown(e) {
        if (e.button === 1) { // Средняя кнопка мыши
            e.preventDefault(); // Предотвращаем стандартную прокрутку
            this.isDragging = true;
            this.lastPos = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
        } else if (e.button === 0) { // Левая кнопка мыши
            const pos = this.getGridPosition(e.clientX, e.clientY);
            
            if (this.currentTool === 'move') {
                const color = this.getColorAt(pos.x, pos.y);
                if (color) {
                    this.isDragging = true;
                    this.draggingArea = {
                        color: color,
                        startX: pos.x,
                        startY: pos.y,
                        pixels: this.getConnectedPixels(pos.x, pos.y, color)
                    };
                    // Очищаем старую область сразу при начале перемещения
                    this.clearArea(this.draggingArea.pixels);
                    this.lastPos = pos;
                }
            } else {
                this.drawAtPosition(pos);
            }
        }
    }
    
    handleMouseUp(e) {
        if (e.button === 1) {
            this.isDragging = false;
            this.canvas.style.cursor = this.currentTool === 'move' ? 'crosshair' : 
                                     this.currentTool === 'eraser' ? 'none' : 'default';
        } else if (e.button === 0 && this.currentTool === 'move') {
            if (this.draggingArea) {
                // Рисуем область в новом месте на основном canvas
                this.drawArea(this.draggingArea.pixels, this.draggingArea.color);
                
                // Скрываем временный canvas
                this.tempCanvas.style.display = 'none';
                
                this.isDragging = false;
                this.draggingArea = null;
                this.saveState();
            }
        }
    }
    
    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.scale *= delta;
        this.scale = Math.max(0.5, Math.min(5, this.scale));

        // Получаем размеры контейнера и масштабированного изображения
        const container = document.getElementById('canvas-container');
        const containerRect = container.getBoundingClientRect();
        const scaledWidth = CANVAS_WIDTH * this.scale;
        const scaledHeight = CANVAS_HEIGHT * this.scale;
        
        // Определяем максимальное смещение (90% от размера)
        const maxOverflowX = scaledWidth * 0.9;
        const maxOverflowY = scaledHeight * 0.9;
        
        // Корректируем позицию если изображение выходит за пределы
        if (scaledWidth <= containerRect.width) {
            // Если изображение меньше контейнера, ограничиваем смещение
            this.offset.x = Math.max(-maxOverflowX, Math.min(maxOverflowX, this.offset.x));
        } else {
            // Если изображение больше контейнера, ограничиваем края
            const minX = containerRect.width - scaledWidth - maxOverflowX;
            const maxX = maxOverflowX;
            this.offset.x = Math.max(minX, Math.min(maxX, this.offset.x));
        }
        
        if (scaledHeight <= containerRect.height) {
            // Если изображение меньше контейнера, ограничиваем смещение
            this.offset.y = Math.max(-maxOverflowY, Math.min(maxOverflowY, this.offset.y));
        } else {
            // Если изображение больше контейнера, ограничиваем края
            const minY = containerRect.height - scaledHeight - maxOverflowY;
            const maxY = maxOverflowY;
            this.offset.y = Math.max(minY, Math.min(maxY, this.offset.y));
        }

        this.updateCanvas();
    }
    
    updateCursorPreview(e) {
        const pos = this.getGridPosition(e.clientX, e.clientY);
        const width = parseInt(document.getElementById('width').value) * GRID_SIZE;
        const height = parseInt(document.getElementById('height').value) * GRID_SIZE;
        
        // Скрываем предпросмотр для инструмента move
        if (this.currentTool === 'move') {
            this.cursorPreview.style.display = 'none';
            return;
        }
        
        this.cursorPreview.style.display = 'block';
        
        if (this.currentTool === 'eraser') {
            // Для ластика делаем круглый курсор
            const size = GRID_SIZE * this.scale;
            this.cursorPreview.style.width = `${size}px`;
            this.cursorPreview.style.height = `${size}px`;
            this.cursorPreview.style.borderRadius = '50%';
            this.cursorPreview.style.border = '1px solid #000';
            this.cursorPreview.style.backgroundColor = 'transparent';
        } else {
            // Для прямоугольника обычный курсор
            this.cursorPreview.style.width = `${width * this.scale}px`;
            this.cursorPreview.style.height = `${height * this.scale}px`;
            this.cursorPreview.style.borderRadius = '0';
            this.cursorPreview.style.backgroundColor = this.currentColor;
            this.cursorPreview.style.border = 'none';
        }
        
        this.cursorPreview.style.left = `${e.clientX - (this.currentTool === 'eraser' ? GRID_SIZE * this.scale / 2 : 0)}px`;
        this.cursorPreview.style.top = `${e.clientY - (this.currentTool === 'eraser' ? GRID_SIZE * this.scale / 2 : 0)}px`;
    }
    
    drawAtPosition(pos) {
        const width = parseInt(document.getElementById('width').value);
        const height = parseInt(document.getElementById('height').value);
        
        if (this.currentTool === 'eraser') {
            this.eraseArea(pos.x, pos.y);
        } else if (this.currentTool === 'rectangle') {
            this.drawRectangle(pos.x, pos.y, width, height);
        }
    }
    
    drawRectangle(x, y, width, height) {
        this.ctx.fillStyle = this.currentColor;
        this.ctx.fillRect(
            x * GRID_SIZE,
            y * GRID_SIZE,
            width * GRID_SIZE,
            height * GRID_SIZE
        );
        this.saveState();
    }
    
    eraseArea(x, y) {
        const color = this.getColorAt(x, y);
        if (color) {
            const pixels = this.getConnectedPixels(x, y, color);
            this.clearArea(pixels);
            this.saveState();
        }
    }
    
    getColorAt(x, y) {
        const imageData = this.ctx.getImageData(
            x * GRID_SIZE,
            y * GRID_SIZE,
            GRID_SIZE,
            GRID_SIZE
        );
        
        const data = imageData.data;
        if (data[3] === 0) return null;
        
        return `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${data[3] / 255})`;
    }
    
    saveState() {
        this.currentStep++;
        this.history = this.history.slice(0, this.currentStep);
        this.history.push(this.canvas.toDataURL());
    }
    
    undo() {
        if (this.currentStep > 0) {
            this.currentStep--;
            const img = new Image();
            img.src = this.history[this.currentStep];
            img.onload = () => {
                this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                this.ctx.drawImage(img, 0, 0);
            };
        }
    }
    
    updateCanvas() {
        this.canvas.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
        this.gridCanvas.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
        this.backgroundCanvas.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
    }
    
    clearCanvas() {
        this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        this.saveState();
    }
    
    getCombinedImage() {
        // Очищаем экспортный canvas
        this.exportCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Рисуем фоновое изображение
        if (this.backgroundImage) {
            this.exportCtx.drawImage(this.backgroundImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
        
        // Рисуем закрашенные пиксели
        this.exportCtx.drawImage(this.canvas, 0, 0);
        
        return this.exportCanvas.toDataURL('image/png');
    }
    
    saveImage() {
        if (!this.backgroundImage) {
            console.error('Фоновое изображение еще не загружено');
            return;
        }
        
        try {
            const dataUrl = this.getCombinedImage();
            const link = document.createElement('a');
            link.download = 'pixel-art.png';
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Ошибка при сохранении:', error);
        }
    }
    
    showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.backgroundColor = '#4CAF50';
        notification.style.color = 'white';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '1000';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    async copyToClipboard() {
        if (!this.backgroundImage) {
            this.showNotification('Ошибка: фоновое изображение еще не загружено');
            return;
        }
        
        try {
            const dataUrl = this.getCombinedImage();
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);
            this.showNotification('Изображение скопировано в буфер обмена');
        } catch (error) {
            console.error('Ошибка при копировании:', error);
            this.showNotification('Ошибка при копировании изображения');
        }
    }
    
    getConnectedPixels(x, y, color) {
        const pixels = new Set();
        const stack = [[x, y]];
        
        while (stack.length) {
            const [currentX, currentY] = stack.pop();
            const key = `${currentX},${currentY}`;
            
            if (!pixels.has(key)) {
                pixels.add(key);
                
                // Проверяем соседние пиксели
                const neighbors = [
                    [currentX - 1, currentY],
                    [currentX + 1, currentY],
                    [currentX, currentY - 1],
                    [currentX, currentY + 1]
                ];
                
                for (const [nx, ny] of neighbors) {
                    if (nx >= 0 && nx < CANVAS_WIDTH / GRID_SIZE && 
                        ny >= 0 && ny < CANVAS_HEIGHT / GRID_SIZE) {
                        const neighborColor = this.getColorAt(nx, ny);
                        if (neighborColor === color) {
                            stack.push([nx, ny]);
                        }
                    }
                }
            }
        }
        
        return Array.from(pixels).map(key => {
            const [x, y] = key.split(',').map(Number);
            return { x, y };
        });
    }
    
    clearArea(pixels) {
        pixels.forEach(pixel => {
            this.ctx.clearRect(
                pixel.x * GRID_SIZE,
                pixel.y * GRID_SIZE,
                GRID_SIZE,
                GRID_SIZE
            );
        });
    }
    
    drawArea(pixels, color) {
        this.ctx.fillStyle = color;
        pixels.forEach(pixel => {
            this.ctx.fillRect(
                pixel.x * GRID_SIZE,
                pixel.y * GRID_SIZE,
                GRID_SIZE,
                GRID_SIZE
            );
        });
    }
    
    isAreaInBounds(pixels) {
        return pixels.every(pixel => 
            pixel.x >= 0 && 
            pixel.x < CANVAS_WIDTH / GRID_SIZE && 
            pixel.y >= 0 && 
            pixel.y < CANVAS_HEIGHT / GRID_SIZE
        );
    }
    
    drawAreaOnCanvas(ctx, pixels, color) {
        ctx.fillStyle = color;
        pixels.forEach(pixel => {
            ctx.fillRect(
                pixel.x * GRID_SIZE,
                pixel.y * GRID_SIZE,
                GRID_SIZE,
                GRID_SIZE
            );
        });
    }
}

// Инициализация при загрузке страницы
window.addEventListener('load', () => {
    new PixelEditor();
}); 