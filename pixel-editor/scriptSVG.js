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
        this.editingTextElement = null;
        this.randomSelectionStart = null;
        this.randomSelectionRect = null;
        this.randomDensityDialog = null;
        this.randomGroup = null;
        
        // История действий
        this.history = [];
        this.maxHistoryLength = 10;
        
        this.cache = new Map();
        
        this.initializeCanvas();
        this.setupEventListeners();
        this.setupTools();
        this.setupTextInputDialog();
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
            
            // Скрываем иконку ластика при выходе из области SVG
            if (this.currentTool === 'eraser') {
                const cursorIcon = document.getElementById('cursor-icon');
                if (cursorIcon) {
                    cursorIcon.style.display = 'none';
                }
            }
        });
        
        this.svg.addEventListener('mouseenter', () => {
            // Показываем иконку ластика при входе в область SVG
            if (this.currentTool === 'eraser') {
                const cursorIcon = document.getElementById('cursor-icon');
                if (cursorIcon) {
                    cursorIcon.style.display = 'block';
                } else {
                    // Если иконки нет, создаем её
                    this.updateCursor(this.currentTool);
                }
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

        // Добавляем обработчик для экспорта проекта
        const exportButton = document.getElementById('export-project');
        if (exportButton) {
            exportButton.addEventListener('click', () => this.exportProject());
        }

        // Добавляем обработчик для импорта проекта
        const importButton = document.getElementById('import-project');
        const importFile = document.getElementById('import-file');
        if (importButton && importFile) {
            importButton.addEventListener('click', () => importFile.click());
            importFile.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.importProject(e.target.files[0]);
                    // Сбрасываем значение input, чтобы можно было загрузить тот же файл повторно
                    e.target.value = '';
                }
            });
        }
    }
    
    setupTools() {
        ['move', 'rectangle', 'oval', 'text', 'eraser', 'random'].forEach(tool => {
            const button = document.getElementById(tool);
            if (button) {
                button.addEventListener('click', () => {
                    this.currentTool = tool;
                    document.querySelectorAll('.toolbar button').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    button.classList.add('active');

                    // Удаляем старую миниатюру, если она есть
                    const oldCursorIcon = document.getElementById('cursor-icon');
                    if (oldCursorIcon) {
                        oldCursorIcon.remove();
                    }
                    
                    // Обновляем курсор при выборе инструмента
                    this.updateCursor(tool);
                });
            }
        });
    }
    
    updateCursor(tool) {
        // Удаляем старую миниатюру, если она есть
        const oldCursorIcon = document.getElementById('cursor-icon');
        if (oldCursorIcon) {
            oldCursorIcon.remove();
        }
        
        switch(tool) {
            case 'move':
                this.svg.style.cursor = 'move'; // IDC_SIZEALL
                break;
            case 'eraser':
                this.svg.style.cursor = 'default'; // Используем стандартный курсор
                // Создаем миниатюру иконки ластика
                const cursorIcon = document.createElement('img');
                cursorIcon.src = 'icons/eraser_tool.svg';
                cursorIcon.id = 'cursor-icon';
                // cursorIcon.style.position = 'fixed';
                // cursorIcon.style.pointerEvents = 'none';
                // cursorIcon.style.width = '16px';
                // cursorIcon.style.height = '16px';
                cursorIcon.style.transform = 'translate(12px, 6px)'; // Смещение от курсора
                cursorIcon.style.zIndex = '9999';
                // cursorIcon.style.filter = 'invert(0.7) sepia(1) saturate(5) hue-rotate(185deg) drop-shadow(1px 1px 1px rgba(0,0,0,0.7))';
                document.body.appendChild(cursorIcon);
                
                // Обновляем позицию иконки при движении мыши
                const updateIconPosition = (e) => {
                    if (this.currentTool === 'eraser') {
                        cursorIcon.style.left = `${e.clientX}px`;
                        cursorIcon.style.top = `${e.clientY}px`;
                    }
                };
                
                // Удаляем старый обработчик, если есть
                if (this._mouseMoveHandler) {
                    document.removeEventListener('mousemove', this._mouseMoveHandler);
                }
                
                // Сохраняем ссылку на обработчик
                this._mouseMoveHandler = updateIconPosition;
                document.addEventListener('mousemove', this._mouseMoveHandler);
                break;
            case 'text':
                this.svg.style.cursor = 'text'; // IDC_NO
                break;
            case 'random':
                this.svg.style.cursor = 'crosshair';
                break;
            default:
                this.svg.style.cursor = 'default';
                // Удаляем обработчик движения, если он был добавлен
                if (this._mouseMoveHandler) {
                    document.removeEventListener('mousemove', this._mouseMoveHandler);
                    this._mouseMoveHandler = null;
                }
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
        if (e.button === 1) { // Средняя кнопка мыши
            e.preventDefault();
            this.isDragging = true;
            this.lastPos = { x: e.clientX, y: e.clientY };
            this.svg.style.cursor = 'grabbing';
            return;
        }
        
        if (e.button !== 0) return; // Только левая кнопка мыши
        
        const pos = this.getMousePos(e);
        
        // Проверяем, есть ли под курсором фигура
        const element = e.target.closest('.shape');
        
        if (this.currentTool === 'move' && element) {
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
            } else if (element.tagName === 'text') {
                this.startPos = {
                    x: parseInt(element.getAttribute('x')),
                    y: parseInt(element.getAttribute('y'))
                };
            }
            this.startMousePos = pos;
        } else if (this.currentTool === 'eraser' && element) {
            // Сохраняем удаление в историю
            this.addToHistory({
                type: 'delete',
                element: element.cloneNode(true)
            });
            element.remove();
            this.saveState();
        } else if (this.currentTool === 'text') {
            // Проверяем, кликнули ли мы на текстовый элемент
            const textElement = element && element.tagName === 'text' ? element : null;
            
            if (textElement) {
                // Редактируем существующий текст
                this.showTextDialog(pos, textElement);
            } else {
                // Создаем новый текст
                this.showTextDialog(pos);
            }
        } else if (this.currentTool === 'random') {
            // Начинаем выделение области для рандомного заполнения
            if (this.randomSelectionRect) {
                this.randomSelectionRect.remove();
                this.randomSelectionRect = null;
            }
            this.randomSelectionStart = pos;
            
            // Создаем прямоугольник выделения
            this.randomSelectionRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            this.randomSelectionRect.setAttribute('x', pos.x);
            this.randomSelectionRect.setAttribute('y', pos.y);
            this.randomSelectionRect.setAttribute('width', 0);
            this.randomSelectionRect.setAttribute('height', 0);
            this.randomSelectionRect.setAttribute('fill', 'none');
            this.randomSelectionRect.setAttribute('stroke', this.currentColor);
            this.randomSelectionRect.setAttribute('stroke-width', '1');
            this.randomSelectionRect.setAttribute('stroke-dasharray', '5,5');
            this.randomSelectionRect.setAttribute('class', 'selection-rect');
            
            this.svg.appendChild(this.randomSelectionRect);
            this.isDragging = true;
        } else if ((this.currentTool === 'rectangle' || this.currentTool === 'oval') && !element) {
            // Создаем новую фигуру только если не кликнули на существующую
            if (this.previewShape) {
                this.previewShape.remove();
                this.previewShape = null;
            }
            this.createShape(pos);
        }
    }
    
    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        
        if (this.isDragging) {
            if (e.buttons === 4 || e.button === 1) { // Средняя кнопка мыши для панорамирования
                const dx = e.clientX - this.lastPos.x;
                const dy = e.clientY - this.lastPos.y;
                
                this.offset.x += dx;
                this.offset.y += dy;
                
                this.updateTransform();
                
                this.lastPos = { x: e.clientX, y: e.clientY };
            } else if (this.currentTool === 'move' && this.selectedElement) {
                // Вычисляем смещение от начальной позиции
                const dx = pos.x - this.startMousePos.x;
                const dy = pos.y - this.startMousePos.y;
                
                if (this.selectedElement.tagName === 'rect') {
                    this.selectedElement.setAttribute('x', this.startPos.x + dx);
                    this.selectedElement.setAttribute('y', this.startPos.y + dy);
                } else if (this.selectedElement.tagName === 'ellipse') {
                    this.selectedElement.setAttribute('cx', this.startPos.x + dx);
                    this.selectedElement.setAttribute('cy', this.startPos.y + dy);
                } else if (this.selectedElement.tagName === 'text') {
                    // Перемещаем текст
                    this.selectedElement.setAttribute('x', this.startPos.x + dx);
                    this.selectedElement.setAttribute('y', this.startPos.y + dy);
                }
            } else if (this.currentTool === 'random' && this.randomSelectionStart && this.randomSelectionRect) {
                // Обновляем размер прямоугольника выделения
                const x = Math.min(this.randomSelectionStart.x, pos.x);
                const y = Math.min(this.randomSelectionStart.y, pos.y);
                const width = Math.abs(pos.x - this.randomSelectionStart.x);
                const height = Math.abs(pos.y - this.randomSelectionStart.y);
                
                this.randomSelectionRect.setAttribute('x', x);
                this.randomSelectionRect.setAttribute('y', y);
                this.randomSelectionRect.setAttribute('width', width);
                this.randomSelectionRect.setAttribute('height', height);
            }
        } else {
            // Обновляем предпросмотр фигуры
            this.updatePreview(pos);
        }
    }
    
    handleMouseUp(e) {
        if (this.isDragging && this.currentTool === 'move' && this.selectedElement) {
            // Фиксируем перемещение
            if (this.selectedElement.tagName === 'rect') {
                const element = this.selectedElement;
                this.addToHistory({
                    type: 'move',
                    element: element,
                    oldX: this.startPos.x,
                    oldY: this.startPos.y,
                    newX: parseInt(element.getAttribute('x')),
                    newY: parseInt(element.getAttribute('y'))
                });
            } else if (this.selectedElement.tagName === 'ellipse') {
                const element = this.selectedElement;
                this.addToHistory({
                    type: 'move',
                    element: element,
                    oldX: this.startPos.x,
                    oldY: this.startPos.y,
                    newX: parseInt(element.getAttribute('cx')),
                    newY: parseInt(element.getAttribute('cy'))
                });
            } else if (this.selectedElement.tagName === 'text') {
                const element = this.selectedElement;
                this.addToHistory({
                    type: 'move',
                    element: element,
                    oldX: this.startPos.x,
                    oldY: this.startPos.y,
                    newX: parseInt(element.getAttribute('x')),
                    newY: parseInt(element.getAttribute('y'))
                });
            }
            this.saveState();
        } else if (this.isDragging && this.currentTool === 'random' && this.randomSelectionRect) {
            // Завершаем выделение области для случайного заполнения
            const x = parseInt(this.randomSelectionRect.getAttribute('x'));
            const y = parseInt(this.randomSelectionRect.getAttribute('y'));
            const width = parseInt(this.randomSelectionRect.getAttribute('width'));
            const height = parseInt(this.randomSelectionRect.getAttribute('height'));
            
            // Убеждаемся, что размеры области достаточны
            if (width > this.GRID_SIZE && height > this.GRID_SIZE) {
                // Показываем диалог для ввода плотности заполнения
                this.showRandomDensityDialog(x, y, width, height);
            } else {
                // Удаляем выделение, если оно слишком маленькое
                this.randomSelectionRect.remove();
                this.randomSelectionRect = null;
            }
        }
        
        this.isDragging = false;
        this.selectedElement = null;
        
        // Обновляем курсор в зависимости от текущего инструмента
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
        if (this.currentTool === 'move' || this.currentTool === 'eraser' || this.currentTool === 'text') {
            if (this.previewShape) {
                this.previewShape.remove();
                this.previewShape = null;
            }
            return;
        }

        const width = parseInt(document.getElementById('width').value) * this.GRID_SIZE;
        const height = parseInt(document.getElementById('height').value) * this.GRID_SIZE;
        
        if (!this.previewShape) {
            this.previewShape = document.createElementNS("http://www.w3.org/2000/svg", 
                this.currentTool === 'rectangle' ? "rect" : "ellipse");
            this.previewShape.setAttribute("fill", this.currentColor);
            this.previewShape.setAttribute("opacity", "0.5");
            this.previewShape.classList.add('preview');
            this.shapesGroup.appendChild(this.previewShape);
        }

        const x = Math.round(pos.x / this.GRID_SIZE) * this.GRID_SIZE;
        const y = Math.round(pos.y / this.GRID_SIZE) * this.GRID_SIZE;

        if (this.currentTool === 'rectangle') {
            this.previewShape.setAttribute("x", x - width/2);
            this.previewShape.setAttribute("y", y - height/2);
            this.previewShape.setAttribute("width", width);
            this.previewShape.setAttribute("height", height);
        } else {
            this.previewShape.setAttribute("cx", x);
            this.previewShape.setAttribute("cy", y);
            this.previewShape.setAttribute("rx", width/2);
            this.previewShape.setAttribute("ry", height/2);
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
                } else if (shape.tagName === 'text' && shape.classList.contains('text-group')) {
                    // Рисуем текст
                    ctx.fillStyle = shape.getAttribute('fill');
                    const fontSize = shape.getAttribute('font-size') || '64px';
                    ctx.font = fontSize + ' Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const x = parseInt(shape.getAttribute('x'));
                    const y = parseInt(shape.getAttribute('y'));
                    ctx.fillText(shape.textContent, x, y);
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
                } else if (shape.tagName === 'text' && shape.classList.contains('text-group')) {
                    // Рисуем текст
                    ctx.fillStyle = shape.getAttribute('fill');
                    const fontSize = shape.getAttribute('font-size') || '64px';
                    ctx.font = fontSize + ' Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const x = parseInt(shape.getAttribute('x'));
                    const y = parseInt(shape.getAttribute('y'));
                    ctx.fillText(shape.textContent, x, y);
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
        // Собираем данные о фигурах
        const shapesData = [];
        this.shapesGroup.childNodes.forEach(element => {
            if (element.classList && element.classList.contains('shape')) {
                let shapeData;
                
                if (element.tagName === 'rect') {
                    shapeData = {
                        type: 'rect',
                        x: parseInt(element.getAttribute('x')),
                        y: parseInt(element.getAttribute('y')),
                        width: parseInt(element.getAttribute('width')),
                        height: parseInt(element.getAttribute('height')),
                        fill: element.getAttribute('fill')
                    };
                } else if (element.tagName === 'ellipse') {
                    shapeData = {
                        type: 'ellipse',
                        cx: parseInt(element.getAttribute('cx')),
                        cy: parseInt(element.getAttribute('cy')),
                        rx: parseInt(element.getAttribute('rx')),
                        ry: parseInt(element.getAttribute('ry')),
                        fill: element.getAttribute('fill')
                    };
                } else if (element.tagName === 'text' && element.classList.contains('text-group')) {
                    shapeData = {
                        type: 'text',
                        x: parseInt(element.getAttribute('x')),
                        y: parseInt(element.getAttribute('y')),
                        fill: element.getAttribute('fill'),
                        textContent: element.textContent,
                        fontSize: element.getAttribute('font-size') || '14px'
                    };
                }
                
                if (shapeData) {
                    shapesData.push(shapeData);
                }
            }
        });
        
        // Сохраняем данные в localStorage
        const state = {
            shapes: shapesData,
            currentTool: this.currentTool,
            currentColor: this.currentColor
        };
        
        localStorage.setItem('pixelEditorState', JSON.stringify(state));
    }
    
    loadState() {
        const savedState = localStorage.getItem('pixelEditorState');
        if (!savedState) return;
        
        try {
            const state = JSON.parse(savedState);
            
            // Устанавливаем инструмент
            if (state.currentTool) {
                this.currentTool = state.currentTool;
                const button = document.getElementById(state.currentTool);
                if (button) {
                    document.querySelectorAll('.toolbar button').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    button.classList.add('active');
                }
            }
            
            // Устанавливаем цвет
            if (state.currentColor) {
                this.currentColor = state.currentColor;
                const colorButtons = document.querySelectorAll('.color-button');
                colorButtons.forEach(btn => {
                    if (btn.dataset.color === state.currentColor) {
                        document.querySelectorAll('.color-button').forEach(b => {
                            b.classList.remove('active');
                        });
                        btn.classList.add('active');
                    }
                });
            }
            
            // Восстанавливаем фигуры
            if (state.shapes && Array.isArray(state.shapes)) {
                state.shapes.forEach(shapeData => {
                    if (shapeData.type === 'rect') {
                        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                        rect.setAttribute("x", shapeData.x);
                        rect.setAttribute("y", shapeData.y);
                        rect.setAttribute("width", shapeData.width);
                        rect.setAttribute("height", shapeData.height);
                        rect.setAttribute("fill", shapeData.fill);
                        rect.classList.add('shape');
                        this.shapesGroup.appendChild(rect);
                    } else if (shapeData.type === 'ellipse') {
                        const ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
                        ellipse.setAttribute("cx", shapeData.cx);
                        ellipse.setAttribute("cy", shapeData.cy);
                        ellipse.setAttribute("rx", shapeData.rx);
                        ellipse.setAttribute("ry", shapeData.ry);
                        ellipse.setAttribute("fill", shapeData.fill);
                        ellipse.classList.add('shape');
                        this.shapesGroup.appendChild(ellipse);
                    } else if (shapeData.type === 'text') {
                        // Создаем текстовый элемент
                        const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
                        textElement.setAttribute("x", shapeData.x);
                        textElement.setAttribute("y", shapeData.y);
                        textElement.setAttribute("text-anchor", "middle");
                        textElement.setAttribute("dominant-baseline", "middle");
                        textElement.setAttribute("fill", shapeData.fill);
                        textElement.setAttribute("font-size", shapeData.fontSize || "64px");
                        textElement.classList.add('svg-text');
                        textElement.classList.add('shape');
                        textElement.classList.add('text-group');
                        textElement.dataset.type = 'text';
                        textElement.id = 'text-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
                        textElement.textContent = shapeData.textContent;
                        
                        this.shapesGroup.appendChild(textElement);
                    }
                });
            }
            
            // Устанавливаем курсор в соответствии с текущим инструментом
            this.updateCursor(this.currentTool);
        } catch (error) {
            console.error('Ошибка при загрузке состояния редактора:', error);
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

    setupTextInputDialog() {
        this.textInputDialog = document.getElementById('textInputDialog');
        this.textInput = document.getElementById('textInput');
        this.confirmTextBtn = document.getElementById('confirmText');
        this.cancelTextBtn = document.getElementById('cancelText');
        
        // Обработчик подтверждения ввода текста
        this.confirmTextBtn.addEventListener('click', () => {
            const text = this.textInput.value.trim();
            if (text) {
                if (this.editingTextElement) {
                    // Обновляем существующий текст
                    this.editingTextElement.textContent = text;
                    // Обновляем цвет текста на текущий выбранный
                    this.editingTextElement.setAttribute('fill', this.currentColor);
                    this.saveState(); // Сохраняем после изменения
                } else {
                    // Создаем новый текстовый элемент
                    this.createTextElement(this.textPosition, text);
                }
            }
            this.hideTextDialog();
        });
        
        // Обработчик отмены ввода текста
        this.cancelTextBtn.addEventListener('click', () => {
            this.hideTextDialog();
        });
        
        // Закрыть диалог по Escape
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isTextDialogVisible()) {
                this.hideTextDialog();
            }
        });
        
        // Отправка формы по Enter
        this.textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.isTextDialogVisible()) {
                this.confirmTextBtn.click();
            }
        });
        
        // Инициализируем диалог для случайного заполнения
        this.setupRandomDensityDialog();
    }
    
    // Методы для диалога ввода текста
    showTextDialog(position, editElement = null) {
        this.textPosition = position;
        this.editingTextElement = editElement;
        
        // Если редактируем существующий текст, заполняем поле ввода
        if (editElement) {
            this.textInput.value = editElement.textContent;
        } else {
            this.textInput.value = '';
        }
        
        this.textInputDialog.style.display = 'block';
        this.textInput.focus();
    }
    
    hideTextDialog() {
        this.textInputDialog.style.display = 'none';
        this.editingTextElement = null;
    }
    
    isTextDialogVisible() {
        return this.textInputDialog.style.display === 'block';
    }
    
    // Создание текстового элемента
    createTextElement(position, text) {
        const x = Math.round(position.x / this.GRID_SIZE) * this.GRID_SIZE;
        const y = Math.round(position.y / this.GRID_SIZE) * this.GRID_SIZE;
        
        // Создаем текстовый элемент
        const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textElement.setAttribute("x", x);
        textElement.setAttribute("y", y);
        textElement.setAttribute("text-anchor", "middle");
        textElement.setAttribute("dominant-baseline", "middle");
        textElement.setAttribute("fill", this.currentColor);
        textElement.setAttribute("font-size", "64px");
        textElement.classList.add('svg-text');
        textElement.classList.add('shape');
        textElement.classList.add('text-group'); // Добавляем этот класс для совместимости
        textElement.dataset.type = 'text';
        textElement.id = 'text-' + Date.now();
        textElement.textContent = text;
        
        this.shapesGroup.appendChild(textElement);
        
        // Добавляем в историю
        this.addToHistory({
            action: 'create',
            element: textElement.cloneNode(true)
        });
        
        this.saveState();
        return textElement;
    }
    
    // Вычисление контрастного цвета для текста
    getContrastColor(hexColor) {
        // Преобразуем hex в RGB
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        
        // Вычисляем яркость (YIQ формула)
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        
        // Возвращаем черный или белый в зависимости от яркости
        return (yiq >= 128) ? '#000000' : '#FFFFFF';
    }

    // Загрузка изображения с промисом
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = (error) => {
                console.error('Ошибка загрузки изображения:', error);
                reject(error);
            };
            img.src = src;
        });
    }

    // Экспорт проекта в JSON-файл
    exportProject() {
        try {
            // Получаем текущие данные
            const shapesData = [];
            this.shapesGroup.childNodes.forEach(element => {
                if (element.classList && element.classList.contains('shape')) {
                    let shapeData;
                    
                    if (element.tagName === 'rect') {
                        shapeData = {
                            type: 'rect',
                            x: parseInt(element.getAttribute('x')),
                            y: parseInt(element.getAttribute('y')),
                            width: parseInt(element.getAttribute('width')),
                            height: parseInt(element.getAttribute('height')),
                            fill: element.getAttribute('fill')
                        };
                    } else if (element.tagName === 'ellipse') {
                        shapeData = {
                            type: 'ellipse',
                            cx: parseInt(element.getAttribute('cx')),
                            cy: parseInt(element.getAttribute('cy')),
                            rx: parseInt(element.getAttribute('rx')),
                            ry: parseInt(element.getAttribute('ry')),
                            fill: element.getAttribute('fill')
                        };
                    } else if (element.tagName === 'text' && element.classList.contains('text-group')) {
                        shapeData = {
                            type: 'text',
                            x: parseInt(element.getAttribute('x')),
                            y: parseInt(element.getAttribute('y')),
                            fill: element.getAttribute('fill'),
                            textContent: element.textContent,
                            fontSize: element.getAttribute('font-size') || '64px'
                        };
                    }
                    
                    if (shapeData) {
                        shapesData.push(shapeData);
                    }
                }
            });
            
            // Создаем объект проекта
            const projectData = {
                shapes: shapesData,
                currentTool: this.currentTool,
                currentColor: this.currentColor,
                version: '1.0',
                timestamp: new Date().toISOString()
            };
            
            // Преобразуем в JSON
            const jsonData = JSON.stringify(projectData, null, 2);
            
            // Создаем Blob и ссылку для скачивания
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Создаем временную ссылку для скачивания
            const a = document.createElement('a');
            a.href = url;
            a.download = 'pixel-editor-project-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
            document.body.appendChild(a);
            a.click();
            
            // Очищаем
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
            // Показываем уведомление
            this.showNotification('Проект успешно экспортирован!');
        } catch (error) {
            console.error('Ошибка при экспорте проекта:', error);
            this.showNotification('Ошибка при экспорте проекта!', true);
        }
    }
    
    // Импорт проекта из JSON-файла
    importProject(file) {
        try {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const projectData = JSON.parse(event.target.result);
                    
                    // Проверяем совместимость
                    if (!projectData.version) {
                        throw new Error('Неверный формат файла проекта');
                    }
                    
                    // Очищаем текущие фигуры
                    while (this.shapesGroup.firstChild) {
                        this.shapesGroup.removeChild(this.shapesGroup.firstChild);
                    }
                    
                    // Восстанавливаем фигуры
                    if (projectData.shapes && Array.isArray(projectData.shapes)) {
                        projectData.shapes.forEach(shapeData => {
                            if (shapeData.type === 'rect') {
                                const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                                rect.setAttribute("x", shapeData.x);
                                rect.setAttribute("y", shapeData.y);
                                rect.setAttribute("width", shapeData.width);
                                rect.setAttribute("height", shapeData.height);
                                rect.setAttribute("fill", shapeData.fill);
                                rect.classList.add('shape');
                                this.shapesGroup.appendChild(rect);
                            } else if (shapeData.type === 'ellipse') {
                                const ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
                                ellipse.setAttribute("cx", shapeData.cx);
                                ellipse.setAttribute("cy", shapeData.cy);
                                ellipse.setAttribute("rx", shapeData.rx);
                                ellipse.setAttribute("ry", shapeData.ry);
                                ellipse.setAttribute("fill", shapeData.fill);
                                ellipse.classList.add('shape');
                                this.shapesGroup.appendChild(ellipse);
                            } else if (shapeData.type === 'text') {
                                // Создаем текстовый элемент
                                const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
                                textElement.setAttribute("x", shapeData.x);
                                textElement.setAttribute("y", shapeData.y);
                                textElement.setAttribute("text-anchor", "middle");
                                textElement.setAttribute("dominant-baseline", "middle");
                                textElement.setAttribute("fill", shapeData.fill);
                                textElement.setAttribute("font-size", shapeData.fontSize || "64px");
                                textElement.classList.add('svg-text');
                                textElement.classList.add('shape');
                                textElement.classList.add('text-group');
                                textElement.dataset.type = 'text';
                                textElement.id = 'text-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
                                textElement.textContent = shapeData.textContent;
                                
                                this.shapesGroup.appendChild(textElement);
                            }
                        });
                    }
                    
                    // Обновляем текущий инструмент и цвет
                    if (projectData.currentTool) {
                        this.currentTool = projectData.currentTool;
                        const button = document.getElementById(projectData.currentTool);
                        if (button) {
                            document.querySelectorAll('.toolbar button').forEach(btn => {
                                btn.classList.remove('active');
                            });
                            button.classList.add('active');
                        }
                    }
                    
                    if (projectData.currentColor) {
                        this.currentColor = projectData.currentColor;
                        const colorButtons = document.querySelectorAll('.color-button');
                        colorButtons.forEach(btn => {
                            if (btn.dataset.color === projectData.currentColor) {
                                document.querySelectorAll('.color-button').forEach(b => {
                                    b.classList.remove('active');
                                });
                                btn.classList.add('active');
                            }
                        });
                    }
                    
                    // Сохраняем в localStorage
                    this.saveState();
                    
                    // Обновляем курсор
                    this.updateCursor(this.currentTool);
                    
                    // Показываем уведомление
                    this.showNotification('Проект успешно импортирован!');
                } catch (error) {
                    console.error('Ошибка при чтении файла проекта:', error);
                    this.showNotification('Ошибка при чтении файла проекта!', true);
                }
            };
            
            reader.onerror = (error) => {
                console.error('Ошибка при чтении файла:', error);
                this.showNotification('Ошибка при чтении файла!', true);
            };
            
            reader.readAsText(file);
        } catch (error) {
            console.error('Ошибка при импорте проекта:', error);
            this.showNotification('Ошибка при импорте проекта!', true);
        }
    }

    // Методы для диалога плотности случайного заполнения
    setupRandomDensityDialog() {
        // Проверяем, существует ли диалог
        this.randomDensityDialog = document.getElementById('randomDensityDialog');
        if (!this.randomDensityDialog) {
            // Создаем HTML для диалога
            const dialogHTML = `
                <div class="text-input-dialog" id="randomDensityDialog" style="display: none;">
                    <div class="text-input-content">
                        <h3>Количество людей</h3>
                        <input type="number" id="densityInput" min="1" value="1000" placeholder="Введите количество людей...">
                        <div>
                            <button id="confirmDensity">ОК</button>
                            <button id="cancelDensity" class="cancel">Отмена</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Добавляем диалог в DOM
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = dialogHTML;
            document.body.appendChild(tempDiv.firstElementChild);
            
            // Получаем ссылки на элементы диалога
            this.randomDensityDialog = document.getElementById('randomDensityDialog');
            this.densityInput = document.getElementById('densityInput');
            this.confirmDensityBtn = document.getElementById('confirmDensity');
            this.cancelDensityBtn = document.getElementById('cancelDensity');
            
            // Добавляем обработчики
            this.confirmDensityBtn.addEventListener('click', () => {
                this.applyRandomFill();
                this.hideRandomDensityDialog();
            });
            
            this.cancelDensityBtn.addEventListener('click', () => {
                this.hideRandomDensityDialog();
                if (this.randomSelectionRect) {
                    this.randomSelectionRect.remove();
                    this.randomSelectionRect = null;
                }
            });
            
            // Закрытие по Escape
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isRandomDensityDialogVisible()) {
                    this.hideRandomDensityDialog();
                    if (this.randomSelectionRect) {
                        this.randomSelectionRect.remove();
                        this.randomSelectionRect = null;
                    }
                }
            });
            
            // Отправка формы по Enter
            this.densityInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && this.isRandomDensityDialogVisible()) {
                    this.confirmDensityBtn.click();
                }
            });
        }
    }
    
    showRandomDensityDialog(x, y, width, height) {
        this.randomArea = { x, y, width, height };
        this.randomDensityDialog.style.display = 'block';
        this.densityInput.focus();
    }
    
    hideRandomDensityDialog() {
        this.randomDensityDialog.style.display = 'none';
        if (this.randomSelectionRect) {
            this.randomSelectionRect.remove();
            this.randomSelectionRect = null;
        }
    }
    
    isRandomDensityDialogVisible() {
        return this.randomDensityDialog.style.display === 'block';
    }
    
    applyRandomFill() {
        // Получаем количество пикселей для заполнения
        const pixelsToFillInput = parseInt(this.densityInput.value) || 0;
        
        // Проверяем значение
        if (pixelsToFillInput < 1) {
            this.showNotification('Количество пикселей должно быть больше 0', true);
            return;
        }
        
        const { x, y, width, height } = this.randomArea;
        
        // Удаляем старую группу, если она есть в этой области
        this.removeRandomGroupInArea(x, y, width, height);
        
        // Создаем новую группу для случайных пикселей
        const randomGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        randomGroup.classList.add('random-group');
        randomGroup.classList.add('shape');
        randomGroup.dataset.x = x;
        randomGroup.dataset.y = y;
        randomGroup.dataset.width = width;
        randomGroup.dataset.height = height;
        
        // Количество пикселей по каждой оси
        const cols = Math.floor(width / this.GRID_SIZE);
        const rows = Math.floor(height / this.GRID_SIZE);
        
        // Общее количество возможных пикселей
        const totalPixels = cols * rows;
        
        // Количество пикселей для заполнения (не больше общего количества)
        const pixelsToFill = Math.min(pixelsToFillInput, totalPixels);
        
        // Если запрошено больше пикселей чем доступно, заполняем всю область
        if (pixelsToFillInput >= totalPixels) {
            // Заполняем все доступные пиксели
            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    const pixelX = x + i * this.GRID_SIZE;
                    const pixelY = y + j * this.GRID_SIZE;
                    
                    const pixel = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    pixel.setAttribute('x', pixelX);
                    pixel.setAttribute('y', pixelY);
                    pixel.setAttribute('width', this.GRID_SIZE);
                    pixel.setAttribute('height', this.GRID_SIZE);
                    pixel.setAttribute('fill', this.currentColor);
                    
                    randomGroup.appendChild(pixel);
                }
            }
        } else {
            // Создаем массив всех возможных позиций
            const positions = [];
            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    positions.push({ i, j });
                }
            }
            
            // Случайно перемешиваем массив
            for (let i = positions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [positions[i], positions[j]] = [positions[j], positions[i]];
            }
            
            // Создаем пиксели для заполнения
            for (let p = 0; p < pixelsToFill; p++) {
                const pos = positions[p];
                const pixelX = x + pos.i * this.GRID_SIZE;
                const pixelY = y + pos.j * this.GRID_SIZE;
                
                const pixel = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                pixel.setAttribute('x', pixelX);
                pixel.setAttribute('y', pixelY);
                pixel.setAttribute('width', this.GRID_SIZE);
                pixel.setAttribute('height', this.GRID_SIZE);
                pixel.setAttribute('fill', this.currentColor);
                
                randomGroup.appendChild(pixel);
            }
        }
        
        // Добавляем группу на SVG
        this.shapesGroup.appendChild(randomGroup);
        
        // Добавляем в историю
        this.addToHistory({
            type: 'create',
            element: randomGroup
        });
        
        // Сохраняем состояние
        this.saveState();
    }
    
    removeRandomGroupInArea(x, y, width, height) {
        // Ищем группы случайных пикселей
        const randomGroups = this.shapesGroup.querySelectorAll('.random-group');
        
        randomGroups.forEach(group => {
            const groupX = parseInt(group.dataset.x);
            const groupY = parseInt(group.dataset.y);
            const groupWidth = parseInt(group.dataset.width);
            const groupHeight = parseInt(group.dataset.height);
            
            // Проверяем пересечение с новой областью
            if (groupX < x + width && 
                groupX + groupWidth > x && 
                groupY < y + height && 
                groupY + groupHeight > y) {
                
                // Добавляем удаление в историю
                this.addToHistory({
                    type: 'delete',
                    element: group.cloneNode(true)
                });
                
                // Удаляем группу
                group.remove();
            }
        });
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
