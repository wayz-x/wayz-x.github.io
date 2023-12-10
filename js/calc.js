var op; 
function handleKeyPress(e){
    var key=e.keyCode || e.which;
     if (key==13){
        calc();
     }
   }

  // функция расчёта
  function calc() {
    var result = ''; // переменная для результата
    var active = $('.active').attr('id'); // ищем выбранную кнопку
    var height = Number(document.getElementById("height").value); // получаем рост из поля ввода

    console.log(height)

    document.getElementById("result").innerHTML = result; // Обнуляем значение вывода если было

    if (active === undefined && (height == 0 || isNaN(height))) { // если не выбран пол и не введен рост
        alert = 'Выберите пол и рост сноубордиста!'
    } else if (height == 0) { // если не введен рост
        alert = 'Введите рост сноубордиста!'
    } else if (active === undefined) { // если не выбран пол
        alert = 'Выберите пол сноубордиста!'
    } else if (isNaN(height)) { // если ввели рост не цифрами
        alert = 'Введите рост цифрами!'
    } else { // если всё ОК считаем
        alert =''
        switch (active) {
          case 'female':
            result = 0.27 * height;
            break;
          case 'male':
            result = 0.29 * height;
            break;
        }
        document.getElementById("result").innerHTML = result.toFixed(1)+' см.';
    }
    document.getElementById("alert").innerHTML = alert;
  }