const GRID_SIZE = 5;
const CANVAS_WIDTH = 6185;
const CANVAS_HEIGHT = 4009;

class PixelEditor {
    constructor() {
        this.canvas = document.getElementById('draw-canvas');
        this.gridCanvas = document.getElementById('grid-canvas');
        this.backgroundCanvas = document.getElementById('background-canvas');
        this.cursorPreview = document.getElementById('cursor-preview');
        
        // Перемещаем cursor-preview в body
        document.body.appendChild(this.cursorPreview);
        this.cursorPreview.style.position = 'fixed';
        this.cursorPreview.style.pointerEvents = 'none';
        this.cursorPreview.style.zIndex = '1000';
        
        // Создаем временный canvas для перемещаемой области
        this.tempCanvas = document.createElement('canvas');
        this.tempCanvas.width = CANVAS_WIDTH;
        this.tempCanvas.height = CANVAS_HEIGHT;
        this.tempCanvas.style.position = 'fixed';
        this.tempCanvas.style.pointerEvents = 'none';
        this.tempCanvas.style.zIndex = '999';
        document.body.appendChild(this.tempCanvas);
        this.tempCtx = this.tempCanvas.getContext('2d', { willReadFrequently: true });
        
        // Создаем временный canvas для сохранения/копирования
        this.exportCanvas = document.createElement('canvas');
        this.exportCanvas.width = CANVAS_WIDTH;
        this.exportCanvas.height = CANVAS_HEIGHT;
        this.exportCtx = this.exportCanvas.getContext('2d', { willReadFrequently: true });
        
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.gridCtx = this.gridCanvas.getContext('2d', { willReadFrequently: true });
        this.backgroundCtx = this.backgroundCanvas.getContext('2d', { willReadFrequently: true });
        
        this.setupCanvas();
        this.setupEventListeners();
        this.setupTools();
        this.setupResizeHandler();
        
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
            canvas.style.width = `${CANVAS_WIDTH}px`;
            canvas.style.height = `${CANVAS_HEIGHT}px`;
        });
    }
    
    setupEventListeners() {
        // Используем passive listeners для wheel
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        
        // Используем throttle для mousemove
        let lastMove = 0;
        const throttle = 16; // ~60fps
        
        this.canvas.addEventListener('mousemove', (e) => {
            const now = Date.now();
            if (now - lastMove >= throttle) {
                this.handleMouseMove(e);
                this.updateCursorPreview(e);
                lastMove = now;
            }
        });
        
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
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
        ['move', 'rectangle', 'oval', 'eraser'].forEach(tool => {
            const toolButton = document.getElementById(tool);
            if (!toolButton) {
                console.warn(`Кнопка инструмента ${tool} не найдена`);
                return;
            }
            
            toolButton.addEventListener('click', () => {
                this.currentTool = tool;
                document.querySelectorAll('.toolbar button').forEach(btn => {
                    btn.classList.remove('active');
                });
                toolButton.classList.add('active');
                
                // Устанавливаем стиль курсора
                if (this.canvas) {
                    this.canvas.style.cursor = tool === 'move' ? 'crosshair' : 
                                             tool === 'eraser' ? 'none' : 'default';
                }
            });
        });
    }
    
    setupResizeHandler() {
        window.addEventListener('resize', () => this.handleResize());
        this.handleResize();
    }

    handleResize() {
        const container = document.querySelector('.canvas-container');
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // Вычисляем масштаб, чтобы вместить весь холст
        const scaleX = containerWidth / CANVAS_WIDTH;
        const scaleY = containerHeight / CANVAS_HEIGHT;
        
        // Вычисляем минимальный масштаб, чтобы холст помещался по высоте
        const minScale = containerHeight / CANVAS_HEIGHT;
        
        // Устанавливаем масштаб, не меньше минимального
        this.scale = Math.max(minScale, Math.min(scaleX, scaleY));
        
        // Центрируем холст
        this.offset = {
            x: (containerWidth - CANVAS_WIDTH * this.scale) / 2,
            y: (containerHeight - CANVAS_HEIGHT * this.scale) / 2
        };
        
        this.updateCanvasTransform();
        this.drawGrid();
        
        // Перерисовываем фоновое изображение
        if (this.backgroundImage) {
            this.backgroundCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            this.backgroundCtx.drawImage(this.backgroundImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
    }

    updateCanvasTransform() {
        const transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
        [this.canvas, this.gridCanvas, this.backgroundCanvas].forEach(canvas => {
            canvas.style.transform = transform;
            canvas.style.transformOrigin = '0 0';
        });
    }
    
    loadBackground() {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = 'background.png';
        img.onload = () => {
            this.backgroundImage = img;
            this.backgroundCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            this.backgroundCtx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            this.handleResize(); // Перерисовываем после загрузки фона
        };
        img.onerror = (error) => {
            console.error('Ошибка загрузки фонового изображения:', error);
            this.showNotification('Ошибка загрузки фонового изображения');
        };
    }
    
    drawGrid() {
        // Очищаем canvas перед рисованием новой сетки
        this.gridCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Используем batch rendering для сетки
        this.gridCtx.beginPath();
        this.gridCtx.strokeStyle = 'rgba(255, 249, 168, 0.2)';
        this.gridCtx.lineWidth = 0.5;
        
        // Рисуем все линии одним path
        for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
            this.gridCtx.moveTo(x, 0);
            this.gridCtx.lineTo(x, CANVAS_HEIGHT);
        }
        
        for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
            this.gridCtx.moveTo(0, y);
            this.gridCtx.lineTo(CANVAS_WIDTH, y);
        }
        
        this.gridCtx.stroke();
    }
    
    getMousePos(e) {
        const container = document.querySelector('.canvas-container');
        if (!container) return null;
        
        const containerRect = container.getBoundingClientRect();
        if (!containerRect) return null;
        
        // Вычисляем координаты относительно canvas с учетом смещения и масштаба
        const x = (e.clientX - containerRect.left - this.offset.x) / this.scale;
        const y = (e.clientY - containerRect.top - this.offset.y) / this.scale;
        
        return { 
            x: Math.floor(x / GRID_SIZE),
            y: Math.floor(y / GRID_SIZE)
        };
    }

    getGridPos(pos) {
        return pos; // Теперь getMousePos уже возвращает координаты в сетке
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const pos = this.getMousePos(e);
        
        if (e.buttons === 4) {
            const container = document.querySelector('.canvas-container');
            const containerRect = container.getBoundingClientRect();
            
            const dx = e.clientX - this.lastPos.x;
            const dy = e.clientY - this.lastPos.y;
            
            let newOffsetX = this.offset.x + dx;
            let newOffsetY = this.offset.y + dy;
            
            const scaledWidth = CANVAS_WIDTH * this.scale;
            const scaledHeight = CANVAS_HEIGHT * this.scale;
            
            const maxOverflowX = scaledWidth * 0.9;
            const maxOverflowY = scaledHeight * 0.9;
            
            if (scaledWidth <= containerRect.width) {
                newOffsetX = Math.max(-maxOverflowX, Math.min(maxOverflowX, newOffsetX));
            } else {
                const minX = containerRect.width - scaledWidth - maxOverflowX;
                const maxX = maxOverflowX;
                newOffsetX = Math.max(minX, Math.min(maxX, newOffsetX));
            }
            
            if (scaledHeight <= containerRect.height) {
                newOffsetY = Math.max(-maxOverflowY, Math.min(maxOverflowY, newOffsetY));
            } else {
                const minY = containerRect.height - scaledHeight - maxOverflowY;
                const maxY = maxOverflowY;
                newOffsetY = Math.max(minY, Math.min(maxY, newOffsetY));
            }
            
            this.offset.x = newOffsetX;
            this.offset.y = newOffsetY;
            
            this.lastPos = { x: e.clientX, y: e.clientY };
            this.updateCanvas();
        } else if (this.isDragging && this.currentTool === 'move' && this.draggingArea) {
            const dx = pos.x - this.draggingArea.startX;
            const dy = pos.y - this.draggingArea.startY;
            
            // Проверяем границы до создания нового массива
            const testPixel = {
                x: this.draggingArea.originalPixels[0].x + dx,
                y: this.draggingArea.originalPixels[0].y + dy
            };
            
            if (this.isAreaInBounds([testPixel])) {
                // Обновляем только смещение
                this.draggingArea.currentOffset = { dx, dy };
                this.updateCursorPreview(e);
            }
        }
        
        this.updateCursorPreview(e);
    }
    
    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        const gridPos = this.getGridPos(pos);
        
        if (e.button === 1) {
            e.preventDefault();
            this.isDragging = true;
            this.lastPos = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
        } else if (e.button === 0) {
            if (this.currentTool === 'move') {
                const pixels = this.getColorAt(pos.x, pos.y);
                if (pixels) {
                    this.isDragging = true;
                    const connectedPixels = this.getConnectedPixels(pos.x, pos.y);
                    this.draggingArea = {
                        startX: pos.x,
                        startY: pos.y,
                        pixels: connectedPixels,
                        originalPixels: JSON.parse(JSON.stringify(connectedPixels)) // Глубокое копирование с сохранением цветов
                    };
                    
                    // Очищаем старую область
                    this.clearArea(connectedPixels);
                }
            } else {
                this.drawAtPosition(pos);
            }
        }
    }
    
    handleMouseUp(e) {
        if (this.isDragging && this.currentTool === 'move' && this.draggingArea) {
            const { dx = 0, dy = 0 } = this.draggingArea.currentOffset || {};
            
            // Создаем новые пиксели с сохранением цветов
            const newPixels = this.draggingArea.originalPixels.map(pixel => ({
                x: pixel.x + dx,
                y: pixel.y + dy,
                pixels: pixel.pixels // Сохраняем оригинальные цвета
            }));
            
            // Рисуем область на основном холсте с сохранением цветов
            this.drawArea(newPixels);
            
            // Сбрасываем состояние
            this.isDragging = false;
            this.draggingArea = null;
            this.cursorPreview.style.display = 'none';
            
            // Сохраняем состояние
            this.saveState();
        }
    }
    
    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        
        // Получаем позицию курсора относительно canvas до масштабирования
        const container = document.querySelector('.canvas-container');
        const containerRect = container.getBoundingClientRect();
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;
        
        // Вычисляем позицию курсора относительно canvas в координатах canvas
        const canvasX = (mouseX - this.offset.x) / this.scale;
        const canvasY = (mouseY - this.offset.y) / this.scale;
        
        // Применяем новый масштаб
        const oldScale = this.scale;
        this.scale *= delta;
        
        // Получаем размеры контейнера для вычисления минимального масштаба
        const containerHeight = container.clientHeight;
        const minScale = containerHeight / CANVAS_HEIGHT;
        
        // Ограничиваем масштаб
        this.scale = Math.max(minScale, Math.min(5, this.scale));
        
        // Если масштаб не изменился, выходим
        if (oldScale === this.scale) return;
        
        // Вычисляем новое смещение, чтобы точка под курсором осталась на месте
        this.offset.x = mouseX - canvasX * this.scale;
        this.offset.y = mouseY - canvasY * this.scale;
        
        // Получаем размеры масштабированного изображения
        const scaledWidth = CANVAS_WIDTH * this.scale;
        const scaledHeight = CANVAS_HEIGHT * this.scale;
        
        // Определяем максимальное смещение (90% от размера)
        const maxOverflowX = scaledWidth * 0.9;
        const maxOverflowY = scaledHeight * 0.9;
        
        // Корректируем позицию если изображение выходит за пределы
        if (scaledWidth <= containerRect.width) {
            this.offset.x = Math.max(-maxOverflowX, Math.min(maxOverflowX, this.offset.x));
        } else {
            const minX = containerRect.width - scaledWidth - maxOverflowX;
            const maxX = maxOverflowX;
            this.offset.x = Math.max(minX, Math.min(maxX, this.offset.x));
        }
        
        if (scaledHeight <= containerRect.height) {
            this.offset.y = Math.max(-maxOverflowY, Math.min(maxOverflowY, this.offset.y));
        } else {
            const minY = containerRect.height - scaledHeight - maxOverflowY;
            const maxY = maxOverflowY;
            this.offset.y = Math.max(minY, Math.min(maxY, this.offset.y));
        }

        // Обновляем трансформацию для всех элементов
        this.updateCanvasTransform();
        
        // Перерисовываем сетку с новым масштабом
        this.drawGrid();
    }
    
    updateCursorPreview(e) {
        const pos = this.getMousePos(e);
        if (!pos) return;
        
        const width = parseInt(document.getElementById('width')?.value || '1');
        const height = parseInt(document.getElementById('height')?.value || '1');
        
        if (this.currentTool === 'move' && !this.isDragging) {
            this.cursorPreview.style.display = 'none';
            return;
        }
        
        this.cursorPreview.style.display = 'block';
        
        if (this.isDragging && this.currentTool === 'move' && this.draggingArea) {
            const bounds = this.getAreaBounds(this.draggingArea.originalPixels);
            const width = (bounds.maxX - bounds.minX + 1) * GRID_SIZE;
            const height = (bounds.maxY - bounds.minY + 1) * GRID_SIZE;
            
            // Создаем временный canvas для отрисовки пикселей
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Рисуем пиксели с их оригинальными цветами
            this.draggingArea.originalPixels.forEach(pixel => {
                if (pixel.pixels) {
                    pixel.pixels.forEach(p => {
                        tempCtx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${p.a})`;
                        tempCtx.fillRect(
                            (pixel.x - bounds.minX) * GRID_SIZE + p.x,
                            (pixel.y - bounds.minY) * GRID_SIZE + p.y,
                            1,
                            1
                        );
                    });
                }
            });
            
            this.cursorPreview.style.width = `${width * this.scale}px`;
            this.cursorPreview.style.height = `${height * this.scale}px`;
            this.cursorPreview.style.backgroundImage = `url(${tempCanvas.toDataURL()})`;
            this.cursorPreview.style.backgroundSize = '100% 100%';
            this.cursorPreview.style.backgroundColor = 'transparent';
            this.cursorPreview.style.border = 'none';
            
            const container = document.querySelector('.canvas-container');
            const containerRect = container.getBoundingClientRect();
            
            const { dx = 0, dy = 0 } = this.draggingArea.currentOffset || {};
            const left = containerRect.left + this.offset.x + (bounds.minX + dx) * GRID_SIZE * this.scale;
            const top = containerRect.top + this.offset.y + (bounds.minY + dy) * GRID_SIZE * this.scale;
            
            this.cursorPreview.style.transform = 'none';
            this.cursorPreview.style.left = `${left}px`;
            this.cursorPreview.style.top = `${top}px`;
        } else if (this.currentTool === 'eraser') {
            const size = GRID_SIZE * 10;
            this.cursorPreview.style.width = `${size * this.scale}px`;
            this.cursorPreview.style.height = `${size * this.scale}px`;
            this.cursorPreview.style.borderRadius = '50%';
            this.cursorPreview.style.border = '2px solid #ff0000';
            this.cursorPreview.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            this.cursorPreview.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.5)';
            
            const previewWidth = parseFloat(this.cursorPreview.style.width);
            const previewHeight = parseFloat(this.cursorPreview.style.height);
            
            this.cursorPreview.style.transform = 'none';
            this.cursorPreview.style.left = `${e.clientX - previewWidth/2}px`;
            this.cursorPreview.style.top = `${e.clientY - previewHeight/2}px`;
        } else {
            this.cursorPreview.style.width = `${width * GRID_SIZE * this.scale}px`;
            this.cursorPreview.style.height = `${height * GRID_SIZE * this.scale}px`;
            this.cursorPreview.style.borderRadius = this.currentTool === 'oval' ? '50%' : '0';
            this.cursorPreview.style.backgroundColor = this.currentColor;
            this.cursorPreview.style.border = 'none';
            this.cursorPreview.style.boxShadow = 'none';
            
            const previewWidth = parseFloat(this.cursorPreview.style.width);
            const previewHeight = parseFloat(this.cursorPreview.style.height);
            
            this.cursorPreview.style.transform = 'none';
            this.cursorPreview.style.left = `${e.clientX - previewWidth/2}px`;
            this.cursorPreview.style.top = `${e.clientY - previewHeight/2}px`;
        }
    }
    
    getAreaBounds(pixels) {
        return pixels.reduce((bounds, pixel) => ({
            minX: Math.min(bounds.minX, pixel.x),
            minY: Math.min(bounds.minY, pixel.y),
            maxX: Math.max(bounds.maxX, pixel.x),
            maxY: Math.max(bounds.maxY, pixel.y)
        }), {
            minX: Infinity,
            minY: Infinity,
            maxX: -Infinity,
            maxY: -Infinity
        });
    }
    
    drawAtPosition(pos) {
        const width = parseInt(document.getElementById('width').value);
        const height = parseInt(document.getElementById('height').value);
        
        if (this.currentTool === 'eraser') {
            this.eraseArea(pos.x, pos.y);
        } else if (this.currentTool === 'rectangle') {
            this.drawRectangle(pos.x, pos.y, width, height);
        } else if (this.currentTool === 'oval') {
            this.drawOval(pos.x, pos.y, width, height);
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
        this.drawGrid();
    }
    
    drawOval(x, y, width, height) {
        this.ctx.fillStyle = this.currentColor;
        
        // Переводим координаты сетки в реальные пиксели
        const centerX = (x + width / 2) * GRID_SIZE;
        const centerY = (y + height / 2) * GRID_SIZE;
        const radiusX = (width * GRID_SIZE) / 2;
        const radiusY = (height * GRID_SIZE) / 2;
        
        this.ctx.beginPath();
        this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        this.ctx.fill();
        
        this.saveState();
        this.drawGrid();
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
        const pixels = [];
        
        // Собираем все непрозрачные пиксели
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0) {
                pixels.push({
                    r: data[i],
                    g: data[i + 1],
                    b: data[i + 2],
                    a: data[i + 3] / 255,
                    x: (i/4) % GRID_SIZE,
                    y: Math.floor((i/4) / GRID_SIZE)
                });
            }
        }
        
        return pixels.length > 0 ? pixels : null;
    }
    
    saveState() {
        // Ограничиваем размер истории
        const MAX_HISTORY = 50;
        
        this.currentStep++;
        this.history = this.history.slice(0, this.currentStep);
        
        // Если история слишком большая, удаляем старые состояния
        if (this.history.length > MAX_HISTORY) {
            this.history = this.history.slice(-MAX_HISTORY);
            this.currentStep = this.history.length - 1;
        }
        
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
        const transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
        this.canvas.style.transform = transform;
        this.gridCanvas.style.transform = transform;
        this.backgroundCanvas.style.transform = transform;
        this.tempCanvas.style.transform = transform;
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        this.saveState();
    }
    
    getCombinedImage() {
        this.exportCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        if (this.backgroundImage) {
            this.exportCtx.drawImage(this.backgroundImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
        
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
        const basePixels = this.getColorAt(x, y);
        if (!basePixels) return [];
        
        while (stack.length) {
            const [currentX, currentY] = stack.pop();
            const key = `${currentX},${currentY}`;
            
            if (!pixels.has(key)) {
                const currentPixels = this.getColorAt(currentX, currentY);
                if (currentPixels) {
                    pixels.add(key);
                    
                    const neighbors = [
                        [currentX - 1, currentY],
                        [currentX + 1, currentY],
                        [currentX, currentY - 1],
                        [currentX, currentY + 1]
                    ];
                    
                    for (const [nx, ny] of neighbors) {
                        if (nx >= 0 && nx < CANVAS_WIDTH / GRID_SIZE && 
                            ny >= 0 && ny < CANVAS_HEIGHT / GRID_SIZE) {
                            const neighborPixels = this.getColorAt(nx, ny);
                            if (neighborPixels) {
                                stack.push([nx, ny]);
                            }
                        }
                    }
                }
            }
        }
        
        return Array.from(pixels).map(key => {
            const [x, y] = key.split(',').map(Number);
            return { 
                x, 
                y,
                pixels: this.getColorAt(x, y)
            };
        });
    }

    drawArea(pixels, ctx = this.ctx) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = GRID_SIZE;
        tempCanvas.height = GRID_SIZE;
        const tempCtx = tempCanvas.getContext('2d');
        
        pixels.forEach(pixel => {
            if (pixel.pixels) {
                // Очищаем временный контекст
                tempCtx.clearRect(0, 0, GRID_SIZE, GRID_SIZE);
                
                // Рисуем каждый суб-пиксель с его оригинальным цветом
                pixel.pixels.forEach(p => {
                    tempCtx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${p.a})`;
                    tempCtx.fillRect(p.x, p.y, 1, 1);
                });
                
                // Копируем на основной холст
                ctx.drawImage(
                    tempCanvas,
                    pixel.x * GRID_SIZE,
                    pixel.y * GRID_SIZE
                );
            } else {
                // Для обратной совместимости
                ctx.fillStyle = color;
                ctx.fillRect(
                    pixel.x * GRID_SIZE,
                    pixel.y * GRID_SIZE,
                    GRID_SIZE,
                    GRID_SIZE
                );
            }
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
    
    isAreaInBounds(pixels) {
        return pixels.every(pixel => 
            pixel.x >= 0 && 
            pixel.x < CANVAS_WIDTH / GRID_SIZE && 
            pixel.y >= 0 && 
            pixel.y < CANVAS_HEIGHT / GRID_SIZE
        );
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        try {
            new PixelEditor();
        } catch (error) {
            console.error('Ошибка при инициализации редактора:', error);
        }
    }, 100);
});