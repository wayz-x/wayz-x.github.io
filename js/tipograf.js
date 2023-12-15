$(document).ready(function () {
    $('p, br, b, a, span, h1, h2, h3, h4, h5, small, strong').each(function() {
        st = $(this).html();
        // console.log(st)
        st = st.replaceAll('  ', ' ');
        st = st.replace(/(?!\s)--(?=\s)/g, '&mdash;')                   //длинное тире
        st = st.replace(/(?<![\s\d])-(?![\d\s])/g, '&ndash;')           //короткое тире
        st = st.replace(/-(?=\d)/g, '&minus;')                          //минус
        st = st.replace(/(^|[\s;>\(\[-])["']/g, '$1&laquo;')                //ёлочки слева
        st = st.replace(/["'](?=[\s-\.!,:;\?\)\]\n\r<]|$)/g, '&raquo;')     //ёлочки справа
        st = st.replace(/(?<=(^|\s)[\p{L}]{1,3}|\d|%) /gu, '&nbsp;')    //висячие предлоги
        st = st.replaceAll('&nbsp; ', '&nbsp;');
        $(this).html(st);
    });
})