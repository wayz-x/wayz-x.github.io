// Variables
let start = {};
let end = {};
let cur = {};
let animpath;
let timer;
let length;
let offsety = $('#svg').offset().top;
let offsetx = $('#svg').offset().left;
const paths = {'prog-2': 'curve0', 'prog-3-1': 'curve1', 'prog-3-2': 'curve2', 'prog-4-1': 'curve3', 'prog-4-2': 'curve4'};

window.onresize = redraw
document.addEventListener('aos:in', ({ detail }) => {
  drawcurves(detail.id)
  })

document.addEventListener('aos:out', ({ detail }) => {
    if (detail.id in paths) {
        animpath = document.getElementById(paths[detail.id]);
        startEracePath()
    }
})

function redraw(){
    for (let value of Object.keys(paths)) {
        let apath = document.getElementById(paths[value]);
        if (apath.getAttribute('ani') == 'in'){
          drawcurves(value)
        } 
    }
    offsety = $('#svg').offset().top;
    offsetx = $('#svg').offset().left;
}

function drawcurves(number){
$('#svg').attr('height', $('#progress_card').height());
$('#svg').attr('width', $('#progress_card').width());

if (window.innerWidth > 768) {
    var div1 = $('#prog-1');
    var div2 = $('#prog-2');
    var div3 = $('#prog-3-1');
    var div4 = $('#prog-3-2');
    var div5 = $('#prog-4-1');
    var div6 = $('#prog-4-2');

// Zero to Base
if (number == 'prog-2'){
    var cur = {'cx1': 150, 'cy1': 10, 'cx2': 0, 'cy2': -150};
    if (window.innerWidth < 992){ // Get the window width
        var cur = {'cx1': 300, 'cy1': 100, 'cx2': 0, 'cy2': 0};}
    calcLine(div1, 'right', cur, div2, 'top', number)}

 // Base to upper
 if (number == 'prog-3-1'){
    var cur = {'cx1': -150, 'cy1': 0, 'cx2': 0, 'cy2': -150}
    if (window.innerWidth < 992) { // Get the window width
      var cur = {'cx1': -150, 'cy1': 100, 'cx2': 0, 'cy2': 0}}
    calcLine(div2, 'left', cur, div3, 'top', number);}

 //Base to flat
 if (number == 'prog-3-2'){
    var cur = {'cx1': 150, 'cy1': 0, 'cx2': 0, 'cy2': -150};
    if (window.innerWidth < 992) { // Get the window width
        var cur = {'cx1': 150, 'cy1': 100, 'cx2': 0, 'cy2': 0}};
    calcLine(div2, 'right', cur, div4, 'top', number);}

 // Upper to freeride
 if (number == 'prog-4-1'){
    var cur = {'cx1': 300, 'cy1': 0, 'cx2': -300, 'cy2': 0};
    if (window.innerWidth < 992) { // Get the window width
        var cur = {'cx1': 70, 'cy1': 0, 'cx2': -70, 'cy2': 0}};
    calcLine(div3, 'right', cur, div6, 'left', number);}

 // Upper to carve
 if (number == 'prog-4-2'){
    var cur = {'cx1': 0, 'cy1': 0, 'cx2': 0, 'cy2': 0}
    calcLine(div3, 'center', cur, div5, 'top', number)}
} else {
 // Hide lines
 for (i = 0; i < 5; i++) {
    let apath = document.getElementById('curve' + i);
    apath.style.animation = 'animateout 0.5s ease-in forwards'}
    }
}

function calcLine(sdiv, spos, cur, ediv, epos, number){
    var start = coord(spos, sdiv);
    var end = coord(epos, ediv)
    var anchors = {
        'x1': start.x+cur.cx1,
        'y1': start.y+cur.cy1,
        'x2': end.x+cur.cx2,
        'y2': end.y+cur.cy2
      };
    draw(number, start, anchors, end);
}

// Draw function
function draw(i, start, cur, end){
  var curve = "M " + start.x + " " + start.y + " C " + cur.x1 + " " + cur.y1 + " "+ cur.x2 + " " + cur.y2 + " " + end.x + " " + end.y;
  let apath = document.getElementById(paths[i]);
  apath.style.opacity = 0;
  apath.setAttribute('d', curve);
  startDrawingPath(apath);
}

// Coordinates function
function coord(type, div){
    var x;
    var y;
 if (type == 'top') {
   x = div.offset().left + (div.width()/2);
   y = div.offset().top;
 }
 if (type == 'right') {
   x = div.offset().left + (div.width())+10;
   y = div.offset().top + (div.height()/2);
 }
 if (type == 'bottom') {
   x = div.offset().left + (div.width()/2);
   y = div.offset().top + (div.height())-20;
 }
 if (type == 'left') {
   x = div.offset().left+ 20;
   y = div.offset().top + (div.height()/2);
 }
 if (type == 'center') {
  x = div.offset().left+ (div.width()/2);
  y = div.offset().top + (div.height()/2);
}
 return {x: x - offsetx, y: y - offsety};
}

// Animate
function startDrawingPath(apath){
  pathLength = apath.getTotalLength();
  apath.style.strokeDasharray = [0,pathLength].join(' ');
  apath.style.animation = 'animatein 1.5s ease-in 350ms forwards';
  apath.setAttribute('ani', 'in');
};

function startEracePath(){
    length = animpath.getTotalLength();
    animpath.style.strokeDasharray = [length,length].join(' ');
    animpath.style.animation = 'animateout 0.5s ease-in forwards'
    animpath.setAttribute('ani', 'out');
  };