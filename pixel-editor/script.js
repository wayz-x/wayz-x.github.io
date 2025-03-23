const GRID_SIZE = 5;
const CANVAS_WIDTH = 6185;
const CANVAS_HEIGHT = 4009;

class PixelEditor {
    constructor() {
        this.canvas = document.getElementById('draw-canvas');
        this.gridCanvas = document.getElementById('grid-canvas');
        this.backgroundCanvas = document.getElementById('background-canvas');
        this.cursorPreview = document.getElementById('cursor-preview');
        
        // Перемещаем cursor-preview внутрь canvas-container
        const container = document.querySelector('.canvas-container');
        container.appendChild(this.cursorPreview);
        this.cursorPreview.style.position = 'absolute';
        this.cursorPreview.style.pointerEvents = 'none';
        
        // Создаем canvas для превью перетаскиваемой области
        this.dragPreview = document.createElement('canvas');
        this.dragPreview.style.position = 'absolute';
        this.dragPreview.style.pointerEvents = 'none';
        this.dragPreview.style.display = 'none';
        container.appendChild(this.dragPreview);
        this.dragPreviewCtx = this.dragPreview.getContext('2d', { willReadFrequently: true });
        
        // Создаем временный canvas для перемещаемой области
        this.tempCanvas = document.createElement('canvas');
        this.tempCanvas.width = CANVAS_WIDTH;
        this.tempCanvas.height = CANVAS_HEIGHT;
        this.tempCanvas.style.position = 'absolute';
        this.tempCanvas.style.top = '0';
        this.tempCanvas.style.left = '0';
        this.tempCanvas.style.pointerEvents = 'none';
        this.tempCanvas.style.display = 'none';
        document.querySelector('.canvas-container').appendChild(this.tempCanvas);
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
        [this.canvas, this.gridCanvas, this.backgroundCanvas, this.tempCanvas].forEach(canvas => {
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
        const rect = this.canvas.getBoundingClientRect();
        
        // Получаем координаты мыши относительно контейнера
        const container = document.querySelector('.canvas-container');
        const containerRect = container.getBoundingClientRect();
        
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
        
        if (e.buttons === 4) { // Средняя кнопка мыши удержана
            const container = document.querySelector('.canvas-container');
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
            // Вычисляем смещение от начальной позиции
            const dx = pos.x - this.draggingArea.startX;
            const dy = pos.y - this.draggingArea.startY;
            
            // Обновляем позиции пикселей
            const newPixels = this.draggingArea.originalPixels.map(pixel => ({
                x: pixel.x + dx,
                y: pixel.y + dy
            }));
            
            if (this.isAreaInBounds(newPixels)) {
                this.tempCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                this.draggingArea.pixels = newPixels;
                this.drawAreaOnCanvas(this.tempCtx, this.draggingArea.pixels, this.draggingArea.color);
                
                // Вычисляем размеры области
                const minX = Math.min(...this.draggingArea.pixels.map(p => p.x));
                const maxX = Math.max(...this.draggingArea.pixels.map(p => p.x));
                const minY = Math.min(...this.draggingArea.pixels.map(p => p.y));
                const maxY = Math.max(...this.draggingArea.pixels.map(p => p.y));
                const width = (maxX - minX + 1) * GRID_SIZE;
                const height = (maxY - minY + 1) * GRID_SIZE;
                
                // Настраиваем превью
                this.dragPreview.width = width;
                this.dragPreview.height = height;
                this.dragPreview.style.width = `${width}px`;
                this.dragPreview.style.height = `${height}px`;
                this.dragPreview.style.display = 'block';
                
                // Очищаем и рисуем область на превью
                this.dragPreviewCtx.clearRect(0, 0, width, height);
                this.dragPreviewCtx.fillStyle = this.draggingArea.color;
                this.draggingArea.pixels.forEach(pixel => {
                    this.dragPreviewCtx.fillRect(
                        (pixel.x - minX) * GRID_SIZE,
                        (pixel.y - minY) * GRID_SIZE,
                        GRID_SIZE,
                        GRID_SIZE
                    );
                });
                
                // Позиционируем превью
                const container = document.querySelector('.canvas-container');
                const containerRect = container.getBoundingClientRect();
                
                // Вычисляем позицию курсора относительно контейнера
                const mouseX = e.clientX - containerRect.left;
                const mouseY = e.clientY - containerRect.top;
                
                // Устанавливаем точку трансформации в левый верхний угол
                this.dragPreview.style.transformOrigin = '0 0';
                this.dragPreview.style.transform = `translate(${mouseX}px, ${mouseY}px) scale(${this.scale})`;
                this.dragPreview.style.left = '0';
                this.dragPreview.style.top = '0';
            }
        }
        
        this.updateCursorPreview(e);
    }
    
    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        const gridPos = this.getGridPos(pos);
        
        if (e.button === 1) { // Средняя кнопка мыши
            e.preventDefault();
            this.isDragging = true;
            this.lastPos = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
        } else if (e.button === 0) { // Левая кнопка мыши
            if (this.currentTool === 'move') {
                const color = this.getColorAt(pos.x, pos.y);
                if (color) {
                    this.isDragging = true;
                    const pixels = this.getConnectedPixels(pos.x, pos.y, color);
                    const minX = Math.min(...pixels.map(p => p.x));
                    const maxX = Math.max(...pixels.map(p => p.x));
                    const minY = Math.min(...pixels.map(p => p.y));
                    const maxY = Math.max(...pixels.map(p => p.y));
                    const centerX = Math.floor((minX + maxX) / 2);
                    const centerY = Math.floor((minY + maxY) / 2);
                    
                    // Сохраняем минимальные координаты как точку отсчета
                    this.draggingArea = {
                        color: color,
                        startX: minX,
                        startY: minY,
                        pixels: pixels,
                        originalPixels: pixels,
                        centerX: centerX,
                        centerY: centerY
                    };
                    
                    // Очищаем старую область сразу при начале перемещения
                    this.clearArea(this.draggingArea.pixels);
                }
            } else {
                this.drawAtPosition(pos);
            }
        }
    }
    
    handleMouseUp(e) {
        const pos = this.getMousePos(e);
        const gridPos = this.getGridPos(pos);
        
        if (e.button === 1) {
            this.isDragging = false;
            this.canvas.style.cursor = this.currentTool === 'move' ? 'crosshair' : 
                                     this.currentTool === 'eraser' ? 'none' : 'default';
        } else if (e.button === 0 && this.currentTool === 'move') {
            if (this.draggingArea) {
                // Рисуем область в новом месте на основном canvas
                this.drawArea(this.draggingArea.pixels, this.draggingArea.color);
                
                // Скрываем превью
                this.dragPreview.style.display = 'none';
                
                this.isDragging = false;
                this.draggingArea = null;
                this.saveState();
            }
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
        const width = parseInt(document.getElementById('width').value);
        const height = parseInt(document.getElementById('height').value);
        
        if (this.currentTool === 'move') {
            this.cursorPreview.style.display = 'none';
            return;
        }
        
        this.cursorPreview.style.display = 'block';
        
        if (this.currentTool === 'eraser') {
            const size = GRID_SIZE * 10;
            this.cursorPreview.style.width = `${size}px`;
            this.cursorPreview.style.height = `${size}px`;
            this.cursorPreview.style.borderRadius = '50%';
            this.cursorPreview.style.border = '2px solid #ff0000';
            this.cursorPreview.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            this.cursorPreview.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.5)';
        } else {
            this.cursorPreview.style.width = `${width * GRID_SIZE}px`;
            this.cursorPreview.style.height = `${height * GRID_SIZE}px`;
            this.cursorPreview.style.borderRadius = '0';
            this.cursorPreview.style.backgroundColor = this.currentColor;
            this.cursorPreview.style.border = 'none';
        }

        const container = document.querySelector('.canvas-container');
        const containerRect = container.getBoundingClientRect();
        
        const left = e.clientX - containerRect.left;
        const top = e.clientY - containerRect.top;
        
        this.cursorPreview.style.transformOrigin = '0 0';
        this.cursorPreview.style.transform = `translate(${left}px, ${top}px) scale(${this.scale})`;
        this.cursorPreview.style.left = '0';
        this.cursorPreview.style.top = '0';
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
        if (data[3] === 0) return null;
        
        return `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${data[3] / 255})`;
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
document.addEventListener('DOMContentLoaded', () => {
    new PixelEditor();
}); 