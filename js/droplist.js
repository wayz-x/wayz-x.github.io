$('.drop').click(function(){ drop(this); return false; });

function drop(clickedElement){
    var obj;
    var icn = clickedElement.getElementsByTagName('i')[0];
    if (clickedElement.parentElement.tagName == 'DIV') {
        obj = clickedElement.nextElementSibling;
    } else {
        obj = clickedElement.parentElement.nextElementSibling;
    }
    // console.log(clickedElement.parentElement)
    obj.classList.toggle('hidden');
    icn.classList.toggle('fa-minus');
    icn.classList.toggle('fa-plus');
}
