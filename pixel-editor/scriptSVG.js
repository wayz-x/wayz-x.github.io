class PixelEditorSVG {
    constructor() {
        this.GRID_SIZE = 5;
        this.CANVAS_WIDTH = 6185;
        this.CANVAS_HEIGHT = 4009;
        
        this.currentTool = 'rectangle';
        this.currentColor = '#000000';
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        this.isDragging = false;
        this.lastPos = { x: 0, y: 0 };
        this.selectedElement = null;
        this.backgroundImage = null;
        this.previewShape = null;
        
        // История действий
        this.history = [];
        this.maxHistoryLength = 10;
        
        this.cache = new Map();
        
        this.initializeCanvas();
        this.setupEventListeners();
        this.setupTools();
        this.loadBackground();
        this.drawGrid();
        this.handleResize();
        
        // Загружаем сохраненное состояние
        this.loadState();
        
        // Устанавливаем начальный курсор
        this.updateCursor(this.currentTool);
        
        // Добавляем обработчик изменения размера окна
        window.addEventListener('resize', () => this.handleResize());
        
        // Сохраняем состояние перед закрытием страницы
        window.addEventListener('beforeunload', () => this.saveState());
    }
    
    initializeCanvas() {
        // Создаем SVG контейнер
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.setAttribute("width", this.CANVAS_WIDTH);
        this.svg.setAttribute("height", this.CANVAS_HEIGHT);
        this.svg.style.position = "absolute";
        
        // Создаем группу для фона
        this.backgroundGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.svg.appendChild(this.backgroundGroup);
        
        // Создаем группу для сетки
        this.gridGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.svg.appendChild(this.gridGroup);
        
        // Создаем группу для фигур
        this.shapesGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.svg.appendChild(this.shapesGroup);
        
        // Добавляем SVG в контейнер
        const container = document.querySelector('.canvas-container');
        container.appendChild(this.svg);
    }
    
    loadBackground() {
        const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
        image.setAttribute("width", this.CANVAS_WIDTH);
        image.setAttribute("height", this.CANVAS_HEIGHT);
        image.setAttribute("x", "0");
        image.setAttribute("y", "0");
        
        // Загружаем изображение
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = 'background.png';
        
        img.onload = () => {
            image.setAttributeNS("http://www.w3.org/1999/xlink", "href", img.src);
            this.backgroundGroup.appendChild(image);
            this.backgroundImage = image;
        };
        
        img.onerror = (error) => {
            console.error('Ошибка загрузки фонового изображения:', error);
        };
    }
    
    setupEventListeners() {
        this.svg.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.svg.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.svg.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.svg.addEventListener('wheel', this.handleWheel.bind(this));
        this.svg.addEventListener('mouseleave', () => {
            if (this.previewShape) {
                this.previewShape.remove();
                this.previewShape = null;
            }
        });
        
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
        
        // Обработчики для кнопок инструментов
        document.querySelectorAll('.color-button').forEach(button => {
            button.addEventListener('click', (e) => {
                document.querySelectorAll('.color-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                e.target.classList.add('active');
                this.currentColor = e.target.dataset.color;
                if (this.previewShape) {
                    this.previewShape.setAttribute('fill', this.currentColor);
                }
            });
        });

        // Добавляем обработчик для кнопки отмены
        const undoButton = document.getElementById('undo');
        if (undoButton) {
            undoButton.addEventListener('click', () => this.undo());
        }

        // Добавляем обработчик для кнопки очистки
        const clearButton = document.getElementById('clear');
        if (clearButton) {
            clearButton.addEventListener('click', () => this.clearCanvas());
        }

        // Добавляем обработчик для кнопки сохранения
        const saveButton = document.getElementById('save');
        if (saveButton) {
            saveButton.addEventListener('click', () => this.saveToFile());
        }

        // Добавляем обработчик для кнопки копирования
        const copyButton = document.getElementById('copy');
        if (copyButton) {
            copyButton.addEventListener('click', () => this.copyToClipboard());
        }
    }
    
    setupTools() {
        ['move', 'rectangle', 'oval', 'eraser'].forEach(tool => {
            const button = document.getElementById(tool);
            if (button) {
                button.addEventListener('click', () => {
                    this.currentTool = tool;
                    document.querySelectorAll('.toolbar button').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    button.classList.add('active');

                    // Обновляем курсор при выборе инструмента
                    this.updateCursor(tool);
                });
            }
        });
    }
    
    updateCursor(tool) {
        switch(tool) {
            case 'move':
                this.svg.style.cursor = 'move'; // IDC_SIZEALL
                break;
            case 'eraser':
                this.svg.style.cursor = 'not-allowed'; // IDC_NO
                break;
            default:
                this.svg.style.cursor = 'default';
        }
    }
    
    drawGrid() {
        // Вместо создания отдельных линий, можно использовать SVG pattern
        const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
        pattern.setAttribute("id", "grid");
        pattern.setAttribute("width", this.GRID_SIZE);
        pattern.setAttribute("height", this.GRID_SIZE);
        pattern.setAttribute("patternUnits", "userSpaceOnUse");

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${this.GRID_SIZE} 0 L 0 0 0 ${this.GRID_SIZE}`);
        path.setAttribute("stroke", "rgba(255, 249, 168, 0.2)");
        path.setAttribute("stroke-width", "0.5");
        path.setAttribute("fill", "none");

        pattern.appendChild(path);
        this.gridGroup.appendChild(pattern);

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("width", "100%");
        rect.setAttribute("height", "100%");
        rect.setAttribute("fill", "url(#grid)");
        
        this.gridGroup.appendChild(rect);
    }
    
    getMousePos(e) {
        const rect = this.svg.getBoundingClientRect();
        const point = this.svg.createSVGPoint();
        
        // Получаем координаты мыши
        point.x = e.clientX;
        point.y = e.clientY;
        
        // Создаем матрицу преобразования
        const matrix = this.svg.getScreenCTM().inverse();
        
        // Преобразуем координаты
        const transformedPoint = point.matrixTransform(matrix);
        
        return {
            x: transformedPoint.x,
            y: transformedPoint.y
        };
    }
    
    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        
        if (e.button === 1) {
            e.preventDefault();
            this.isDragging = true;
            this.lastPos = { x: e.clientX, y: e.clientY };
            this.svg.style.cursor = 'grabbing';
        } else if (e.button === 0) {
            if (this.currentTool === 'move') {
                const element = e.target.closest('.shape');
                if (element) {
                    this.selectedElement = element;
                    this.isDragging = true;
                    
                    // Сохраняем начальную позицию для истории
                    if (element.tagName === 'rect') {
                        this.startPos = {
                            x: parseInt(element.getAttribute('x')),
                            y: parseInt(element.getAttribute('y'))
                        };
                    } else if (element.tagName === 'ellipse') {
                        this.startPos = {
                            x: parseInt(element.getAttribute('cx')),
                            y: parseInt(element.getAttribute('cy'))
                        };
                    }
                    this.startMousePos = pos;
                }
            } else if (this.currentTool === 'eraser') {
                const element = e.target.closest('.shape');
                if (element) {
                    // Сохраняем удаление в историю
                    this.addToHistory({
                        type: 'delete',
                        element: element
                    });
                    element.remove();
                }
            } else {
                if (this.previewShape) {
                    this.previewShape.remove();
                    this.previewShape = null;
                }
                this.createShape(pos);
            }
        }
    }
    
    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        
        // Обновляем превью если не в режиме перетаскивания
        if (!this.isDragging) {
            this.updatePreview(pos);
        }
        
        if (this.isDragging) {
            if (this.currentTool === 'move' && this.selectedElement) {
                // Вычисляем смещение от начальной позиции
                const dx = pos.x - this.startMousePos.x;
                const dy = pos.y - this.startMousePos.y;
                
                if (this.selectedElement.tagName === 'rect') {
                    this.selectedElement.setAttribute('x', this.startPos.x + dx);
                    this.selectedElement.setAttribute('y', this.startPos.y + dy);
                } else if (this.selectedElement.tagName === 'ellipse') {
                    this.selectedElement.setAttribute('cx', this.startPos.x + dx);
                    this.selectedElement.setAttribute('cy', this.startPos.y + dy);
                }
            } else if (e.buttons === 4) { // Панорамирование
                const dx = e.clientX - this.lastPos.x;
                const dy = e.clientY - this.lastPos.y;
                
                this.offset.x += dx;
                this.offset.y += dy;
                
                this.updateTransform();
                this.lastPos = { x: e.clientX, y: e.clientY };
            }
        }
    }
    
    handleMouseUp(e) {
        if (this.isDragging && this.selectedElement) {
            // Сохраняем перемещение в историю
            const element = this.selectedElement;
            if (element.tagName === 'rect') {
                this.addToHistory({
                    type: 'move',
                    element: element,
                    oldX: this.startPos.x,
                    oldY: this.startPos.y,
                    newX: parseInt(element.getAttribute('x')),
                    newY: parseInt(element.getAttribute('y'))
                });
            } else if (element.tagName === 'ellipse') {
                this.addToHistory({
                    type: 'move',
                    element: element,
                    oldX: this.startPos.x,
                    oldY: this.startPos.y,
                    newX: parseInt(element.getAttribute('cx')),
                    newY: parseInt(element.getAttribute('cy'))
                });
            }
            // Сохраняем состояние после перемещения
            this.saveState();
        }
        
        this.isDragging = false;
        this.selectedElement = null;
        
        // Восстанавливаем курсор текущего инструмента
        this.updateCursor(this.currentTool);
    }
    
    handleResize() {
        const container = document.querySelector('.canvas-container');
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // Вычисляем масштаб, чтобы вместить весь холст
        const scaleX = containerWidth / this.CANVAS_WIDTH;
        const scaleY = containerHeight / this.CANVAS_HEIGHT;
        
        // Вычисляем минимальный масштаб, чтобы холст помещался по высоте
        const minScale = containerHeight / this.CANVAS_HEIGHT;
        
        // Устанавливаем масштаб, не меньше минимального
        this.scale = Math.max(minScale, Math.min(scaleX, scaleY));
        
        // Центрируем холст
        this.offset = {
            x: (containerWidth - this.CANVAS_WIDTH * this.scale) / 2,
            y: (containerHeight - this.CANVAS_HEIGHT * this.scale) / 2
        };
        
        this.updateTransform();
        this.drawGrid();
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
        const minScale = containerHeight / this.CANVAS_HEIGHT;
        
        // Ограничиваем масштаб
        this.scale = Math.max(minScale, Math.min(5, this.scale));
        
        // Если масштаб не изменился, выходим
        if (oldScale === this.scale) return;
        
        // Вычисляем новое смещение, чтобы точка под курсором осталась на месте
        this.offset.x = mouseX - canvasX * this.scale;
        this.offset.y = mouseY - canvasY * this.scale;
        
        // Получаем размеры масштабированного изображения
        const scaledWidth = this.CANVAS_WIDTH * this.scale;
        const scaledHeight = this.CANVAS_HEIGHT * this.scale;
        
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
        
        this.updateTransform();
    }
    
    updateTransform() {
        const transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
        this.svg.style.transform = transform;
        this.svg.style.transformOrigin = '0 0';
    }
    
    createShape(pos) {
        const width = parseInt(document.getElementById('width').value) * this.GRID_SIZE;
        const height = parseInt(document.getElementById('height').value) * this.GRID_SIZE;
        
        let shape;
        if (this.currentTool === 'rectangle') {
            shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            const x = Math.round(pos.x / this.GRID_SIZE) * this.GRID_SIZE;
            const y = Math.round(pos.y / this.GRID_SIZE) * this.GRID_SIZE;
            shape.setAttribute("x", x - width/2);
            shape.setAttribute("y", y - height/2);
            shape.setAttribute("width", width);
            shape.setAttribute("height", height);
        } else if (this.currentTool === 'oval') {
            shape = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
            const cx = Math.round(pos.x / this.GRID_SIZE) * this.GRID_SIZE;
            const cy = Math.round(pos.y / this.GRID_SIZE) * this.GRID_SIZE;
            shape.setAttribute("cx", cx);
            shape.setAttribute("cy", cy);
            shape.setAttribute("rx", width/2);
            shape.setAttribute("ry", height/2);
        }
        
        if (shape) {
            shape.setAttribute("fill", this.currentColor);
            shape.classList.add('shape');
            this.shapesGroup.appendChild(shape);
            // Добавляем создание в историю
            this.addToHistory({
                type: 'create',
                element: shape
            });
            // Сохраняем состояние после создания фигуры
            this.saveState();
        }
    }

    updatePreview(pos) {
        const width = parseInt(document.getElementById('width').value) * this.GRID_SIZE;
        const height = parseInt(document.getElementById('height').value) * this.GRID_SIZE;
        
        // Удаляем старое превью если есть
        if (this.previewShape) {
            this.previewShape.remove();
        }
        
        // Создаем новое превью только если выбран инструмент рисования
        if (this.currentTool !== 'move' && this.currentTool !== 'eraser') {
            let shape;
            if (this.currentTool === 'rectangle') {
                shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                const x = Math.round(pos.x / this.GRID_SIZE) * this.GRID_SIZE;
                const y = Math.round(pos.y / this.GRID_SIZE) * this.GRID_SIZE;
                shape.setAttribute("x", x - width/2);
                shape.setAttribute("y", y - height/2);
                shape.setAttribute("width", width);
                shape.setAttribute("height", height);
            } else if (this.currentTool === 'oval') {
                shape = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
                const cx = Math.round(pos.x / this.GRID_SIZE) * this.GRID_SIZE;
                const cy = Math.round(pos.y / this.GRID_SIZE) * this.GRID_SIZE;
                shape.setAttribute("cx", cx);
                shape.setAttribute("cy", cy);
                shape.setAttribute("rx", width/2);
                shape.setAttribute("ry", height/2);
            }
            
            if (shape) {
                shape.setAttribute("fill", this.currentColor);
                shape.setAttribute("opacity", "0.5");
                shape.classList.add('preview');
                this.shapesGroup.appendChild(shape);
                this.previewShape = shape;
            }
        }
    }

    // Добавляем действие в историю
    addToHistory(action) {
        this.history.push(action);
        if (this.history.length > this.maxHistoryLength) {
            this.history.shift();
        }
    }

    // Отмена последнего действия
    undo() {
        const lastAction = this.history.pop();
        if (lastAction) {
            if (lastAction.type === 'create') {
                lastAction.element.remove();
            } else if (lastAction.type === 'delete') {
                this.shapesGroup.appendChild(lastAction.element);
            } else if (lastAction.type === 'move') {
                if (lastAction.element.tagName === 'rect') {
                    lastAction.element.setAttribute('x', lastAction.oldX);
                    lastAction.element.setAttribute('y', lastAction.oldY);
                } else if (lastAction.element.tagName === 'ellipse') {
                    lastAction.element.setAttribute('cx', lastAction.oldX);
                    lastAction.element.setAttribute('cy', lastAction.oldY);
                }
            } else if (lastAction.type === 'clear') {
                // Восстанавливаем все удаленные фигуры
                lastAction.elements.forEach(element => {
                    this.shapesGroup.appendChild(element);
                });
            }
            // Сохраняем состояние после отмены
            this.saveState();
        }
    }

    clearCanvas() {
        // Сохраняем все фигуры в истории перед удалением
        const shapes = Array.from(this.shapesGroup.children);
        if (shapes.length > 0) {
            this.addToHistory({
                type: 'clear',
                elements: shapes
            });
            
            // Удаляем все фигуры
            while (this.shapesGroup.firstChild) {
                this.shapesGroup.firstChild.remove();
            }
            // Сохраняем состояние после очистки
            this.saveState();
        }
    }

    saveToFile() {
        // Создаем временный canvas для рендеринга
        const canvas = document.createElement('canvas');
        canvas.width = this.CANVAS_WIDTH;
        canvas.height = this.CANVAS_HEIGHT;
        const ctx = canvas.getContext('2d');

        // Сначала рисуем фон
        const bgImage = new Image();
        bgImage.crossOrigin = 'anonymous';
        bgImage.src = 'background.png';

        bgImage.onload = () => {
            // Рисуем фоновое изображение
            ctx.drawImage(bgImage, 0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

            // Затем рисуем сетку
            ctx.strokeStyle = 'rgba(255, 249, 168, 0.2)';
            ctx.lineWidth = 0.5;

            // Вертикальные линии
            for (let x = 0; x <= this.CANVAS_WIDTH; x += this.GRID_SIZE) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, this.CANVAS_HEIGHT);
                ctx.stroke();
            }

            // Горизонтальные линии
            for (let y = 0; y <= this.CANVAS_HEIGHT; y += this.GRID_SIZE) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(this.CANVAS_WIDTH, y);
                ctx.stroke();
            }

            // Рисуем все фигуры
            this.shapesGroup.childNodes.forEach(shape => {
                ctx.fillStyle = shape.getAttribute('fill');
                
                if (shape.tagName === 'rect') {
                    const x = parseInt(shape.getAttribute('x'));
                    const y = parseInt(shape.getAttribute('y'));
                    const width = parseInt(shape.getAttribute('width'));
                    const height = parseInt(shape.getAttribute('height'));
                    ctx.fillRect(x, y, width, height);
                } else if (shape.tagName === 'ellipse') {
                    const cx = parseInt(shape.getAttribute('cx'));
                    const cy = parseInt(shape.getAttribute('cy'));
                    const rx = parseInt(shape.getAttribute('rx'));
                    const ry = parseInt(shape.getAttribute('ry'));
                    
                    ctx.beginPath();
                    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

            // Сохраняем результат
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'foure-map.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 'image/png');
        };
    }

    copyToClipboard() {
        // Создаем временный canvas для рендеринга
        const canvas = document.createElement('canvas');
        canvas.width = this.CANVAS_WIDTH;
        canvas.height = this.CANVAS_HEIGHT;
        const ctx = canvas.getContext('2d');

        // Сначала рисуем фон
        const bgImage = new Image();
        bgImage.crossOrigin = 'anonymous';
        bgImage.src = 'background.png';

        bgImage.onload = async () => {
            // Рисуем фоновое изображение
            ctx.drawImage(bgImage, 0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

            // Затем рисуем сетку
            ctx.strokeStyle = 'rgba(255, 249, 168, 0.2)';
            ctx.lineWidth = 0.5;

            // Вертикальные линии
            for (let x = 0; x <= this.CANVAS_WIDTH; x += this.GRID_SIZE) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, this.CANVAS_HEIGHT);
                ctx.stroke();
            }

            // Горизонтальные линии
            for (let y = 0; y <= this.CANVAS_HEIGHT; y += this.GRID_SIZE) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(this.CANVAS_WIDTH, y);
                ctx.stroke();
            }

            // Рисуем все фигуры
            this.shapesGroup.childNodes.forEach(shape => {
                ctx.fillStyle = shape.getAttribute('fill');
                
                if (shape.tagName === 'rect') {
                    const x = parseInt(shape.getAttribute('x'));
                    const y = parseInt(shape.getAttribute('y'));
                    const width = parseInt(shape.getAttribute('width'));
                    const height = parseInt(shape.getAttribute('height'));
                    ctx.fillRect(x, y, width, height);
                } else if (shape.tagName === 'ellipse') {
                    const cx = parseInt(shape.getAttribute('cx'));
                    const cy = parseInt(shape.getAttribute('cy'));
                    const rx = parseInt(shape.getAttribute('rx'));
                    const ry = parseInt(shape.getAttribute('ry'));
                    
                    ctx.beginPath();
                    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

            try {
                // Конвертируем canvas в blob
                const blob = await new Promise(resolve => canvas.toBlob(resolve));
                // Создаем ClipboardItem
                const item = new ClipboardItem({ 'image/png': blob });
                // Копируем в буфер обмена
                await navigator.clipboard.write([item]);
                this.showNotification('Изображение скопировано в буфер обмена!');
            } catch (err) {
                console.error('Ошибка при копировании в буфер:', err);
                this.showNotification('Ошибка при копировании в буфер!', true);
            }
        };
    }

    showNotification(message, isError = false) {
        // Создаем элемент уведомления
        const notification = document.createElement('div');
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.backgroundColor = isError ? '#ff4444' : '#44ff44';
        notification.style.color = '#fff';
        notification.style.zIndex = '1000';
        notification.textContent = message;

        // Добавляем уведомление на страницу
        document.body.appendChild(notification);

        // Удаляем уведомление через 3 секунды
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s ease';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }

    // Сохраняем состояние в localStorage
    saveState() {
        // Добавим дебаунс для предотвращения частых сохранений
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            const shapes = Array.from(this.shapesGroup.children).map(this.serializeShape);
            const state = {
                shapes,
                currentTool: this.currentTool,
                currentColor: this.currentColor
            };
            localStorage.setItem('pixelEditorState', JSON.stringify(state));
        }, 500);
    }
    
    serializeShape(shape) {
        const baseData = {
            type: shape.tagName.toLowerCase(),
            fill: shape.getAttribute('fill'),
            class: shape.getAttribute('class')
        };

        const attrs = shape.tagName === 'rect' 
            ? ['x', 'y', 'width', 'height']
            : ['cx', 'cy', 'rx', 'ry'];

        return attrs.reduce((data, attr) => {
            data[attr] = shape.getAttribute(attr);
            return data;
        }, baseData);
    }
    
    // Загружаем состояние из localStorage
    loadState() {
        const savedState = localStorage.getItem('pixelEditorState');
        if (savedState) {
            const state = JSON.parse(savedState);
            
            // Восстанавливаем фигуры
            state.shapes.forEach(shapeData => {
                let shape;
                if (shapeData.type === 'rect') {
                    shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    shape.setAttribute("x", shapeData.x);
                    shape.setAttribute("y", shapeData.y);
                    shape.setAttribute("width", shapeData.width);
                    shape.setAttribute("height", shapeData.height);
                } else if (shapeData.type === 'ellipse') {
                    shape = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
                    shape.setAttribute("cx", shapeData.cx);
                    shape.setAttribute("cy", shapeData.cy);
                    shape.setAttribute("rx", shapeData.rx);
                    shape.setAttribute("ry", shapeData.ry);
                }
                
                if (shape) {
                    shape.setAttribute("fill", shapeData.fill);
                    shape.setAttribute("class", shapeData.class);
                    this.shapesGroup.appendChild(shape);
                }
            });
            
            // Восстанавливаем текущий инструмент
            this.currentTool = state.currentTool;
            document.querySelectorAll('.toolbar button').forEach(btn => {
                btn.classList.remove('active');
            });
            const toolButton = document.getElementById(this.currentTool);
            if (toolButton) {
                toolButton.classList.add('active');
            }
            
            // Восстанавливаем текущий цвет
            this.currentColor = state.currentColor;
            document.querySelectorAll('.color-button').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.color === this.currentColor) {
                    btn.classList.add('active');
                }
            });
        }
    }

    getCachedValue(key, generator) {
        if (!this.cache.has(key)) {
            this.cache.set(key, generator());
        }
        return this.cache.get(key);
    }

    clearCache() {
        this.cache.clear();
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        try {
            new PixelEditorSVG();
        } catch (error) {
            console.error('Ошибка при инициализации SVG редактора:', error);
        }
    }, 100);
});
