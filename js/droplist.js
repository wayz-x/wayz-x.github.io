$('.drop').click(function(){ drop(this); return false; });

function drop(clickedElement){
    var obj = clickedElement.parentElement.nextElementSibling;
    var icn = clickedElement.getElementsByTagName('i')[0];
    if (clickedElement.parentElement.tagName == 'DIV') {
        obj = clickedElement.nextElementSibling;
    }
    console.log(clickedElement.nextElementSibling.tagName)
    obj.classList.toggle('hidden');
    icn.classList.toggle('fa-minus');
    icn.classList.toggle('fa-plus');
}
