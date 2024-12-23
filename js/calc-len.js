var op;
var lenbd = Array; 
function handleKeyPress(e){
    var key=e.keyCode || e.which;
     if (key==13){
        calc();
     }
   }

  // функция расчёта
  function calc() {
    var result = ''; // переменная для результата
    //var active = $('.active').attr('id'); // ищем выбранную кнопку 
    var height = Number(document.getElementById("height").value); // получаем рост из поля ввода
    var weight = Number(document.getElementById("weight").value); // получаем вес из поля ввода

    console.log(height)

    document.getElementById("result").innerHTML = result; // Обнуляем значение вывода если было

    if ((weight == 0 || isNaN(weight)) && (height == 0 || isNaN(height))) { // если не выбран пол и не введен рост
        alert('Введите рост и вес сноубордиста!')
    } else if (height == 0) { // если не введен рост
        alert('Введите рост сноубордиста!')
    } else if (isNaN(height)) { // если ввели рост не цифрами
        alert('Введите рост цифрами!')
    } else if (weight == 0) { // если не введен вес
        alert('Введите вес сноубордиста!')
    } else if (isNaN(weight)) { // если ввели вес не цифрами
        alert('Введите вес цифрами!')
    } else { // если всё ОК считаем
        result = getTableValueByHeightAndWeight(height, weight)
        console.log(`Результат для роста ${height} см и веса ${weight} кг:`, result);
        document.getElementById("result").innerHTML = '<h5>Ваша ростовка: '+result+' см.</h5>';
    }
  }

  function alert(alert) {
    document.getElementById("result").innerHTML = '<p class="alert">'+alert+'</p>';
  }

  // Данные таблицы ростовок
const tableData = [
  { heightRange: [0, 155], weights: { "50": "146-148", "50-59": "147-149", "60-69": "150-152", "70-79": "153-155", "80-89": "154-156", "90-99": "157-159", "100+": "160" } },
  { heightRange: [155, 169], weights: { "50": "147-149", "50-59": "149-151", "60-69": "151-153", "70-79": "154-157", "80-89": "155-157", "90-99": "158-160", "100+": "159-161" } },
  { heightRange: [170, 182], weights: { "50": "149-151", "50-59": "151-153", "60-69": "155-157", "70-79": "158-160", "80-89": "157-159", "90-99": "162-164", "100+": "162-164" } },
  { heightRange: [183, 199], weights: { "50": "150-152", "50-59": "151-153", "60-69": "154-156", "70-79": "157-159", "80-89": "159-161", "90-99": "162-164", "100+": "162-164" } },
  { heightRange: [200, Infinity], weights: { "50": "151-153", "50-59": "153-155", "60-69": "155-157", "70-79": "158-160", "80-89": "159-161", "90-99": "162-164", "100+": "164-166" } },
];

// Функция для определения диапазона веса
function findWeightRange(weight) {
  const weightRanges = {
    "50": [0, 50],
    "50-59": [50, 59],
    "60-69": [60, 69],
    "70-79": [70, 79],
    "80-89": [80, 89],
    "90-99": [90, 99],
    "100+": [100, Infinity],
  };

  // Найти диапазон, куда попадает вес
  for (const [key, range] of Object.entries(weightRanges)) {
    if (weight >= range[0] && weight <= range[1]) {
      return key;
    }
  }
  return null; // Если вес не найден
}

// Функция для получения значения таблицы
function getTableValueByHeightAndWeight(userHeight, userWeight) {
  // Находим строку по росту
  const row = tableData.find(row => userHeight >= row.heightRange[0] && userHeight <= row.heightRange[1]);

  if (!row) {
    return "Рост не найден в таблице";
  }

  // Определяем диапазон веса
  const weightKey = findWeightRange(userWeight);
  if (!weightKey) {
    return "Вес не найден в таблице";
  }

  // Получаем значение из таблицы
  const value = row.weights[weightKey];
  return value ? value : "Данные отсутствуют";
}