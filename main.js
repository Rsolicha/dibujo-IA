/*
    variables
*/
var model;
var canvas;
var classNames = [];
var canvas;
var coords = [];
var mousePressed = false;
var mode;
google.charts.load('current', {'packages':['corechart']});


/*
    Función que dirige el canvas, en ella se maneja los listener del mouse dentro del canvas
    si se empieza a dibujar detecta ese movimiento con el objetivo de tener trazabilidad y guardar
    la coordenada del tipo de trazo. Si se termina de dibujar dispara la función de obtener los datos
*/ 
$(function() {
    canvas = window._canvas = new fabric.Canvas('canvas');
    canvas.backgroundColor = '#ffffff';
    canvas.isDrawingMode = 0;
    canvas.freeDrawingBrush.color = "black";
    canvas.freeDrawingBrush.width = 10;
    canvas.renderAll();
    //setup listeners 
    canvas.on('mouse:up', function(e) {
        getFrame();
        mousePressed = false
    });
    canvas.on('mouse:down', function(e) {
        mousePressed = true
    });
    canvas.on('mouse:move', function(e) {
        recordCoor(e)
    });
})

/*
    Obtiene el porcentaje de la predicción y también la etiquete que se 
    procede a almacenar en una lista requerida por los charts de google
*/
function setTable(top5, probs) {
    //loop over the predictions 
    let list = [['Task', 'Hours per Day']]
    for (var i = 0; i < top5.length; i++) {
        let sublist = [top5[i], Math.round(probs[i] * 100)];
        list.push(sublist)
    }
    // Load google charts
    console.log(list)
    google.charts.setOnLoadCallback(drawChart(list));
}

/**
 * Se obtiene la lista llena con los resultados y se procede a setearlos 
 * en el chart de google, así mismo se le asigna la altura y la anchura
 * y se crea el chart en el div con id piechart
 */
function drawChart(list) {
    var data = google.visualization.arrayToDataTable(list);
    // Optional; add a title and set the width and height of the chart
    var options = {'title':'Resultados', 'width':550, 'height':400};

    // Display the chart inside the <div> element with id="piechart"
    var chart = new google.visualization.PieChart(document.getElementById('piechart'));
    chart.draw(data, options);
}

/**
 * Esta funcion se corre cada vez que se crea un trazo dentro del canva, cada 
 * movimiento en cualquier dirección este se encarga de almacenar cada coordeanada
 * para luego transformarlas y que sea leido por el TensorFlow
 */
function recordCoor(event) {
    var pointer = canvas.getPointer(event.e);
    var posX = pointer.x;
    var posY = pointer.y;

    if (posX >= 0 && posY >= 0 && mousePressed) {
        coords.push(pointer)
    }
}

/**
 * Esta función se encarga de obtener el cuadrado delimitador
 * mínimo alrededor del dibujo en el se mapean los resultados 
 * y se divide en coordenadas X y coodenadas Y y luego se aplica 
 * una función de Math para encontrar la coordenada máxima y mímina
 * tanto de X como de Y con ello se encuentran los límites
 */
function getMinBox() {
    //get coordinates 
    var coorX = coords.map(function(p) {
        return p.x
    });
    var coorY = coords.map(function(p) {
        return p.y
    });

    //find top left and bottom right corners 
    var min_coords = {
        x: Math.min.apply(null, coorX),
        y: Math.min.apply(null, coorY)
    }
    var max_coords = {
        x: Math.max.apply(null, coorX),
        y: Math.max.apply(null, coorY)
    }

    //return as strucut 
    return {
        min: min_coords,
        max: max_coords
    }
}

/**
 * Esta función se encarga de obtener los datos de imagen para ello
 * canvas tiene la opción de regresar la información de la imagen
 * pero para ello necesita las coordenadas delimitidoras de la imagen
 * y con ello ya devuelve la información necesaria
 */
function getImageData() {
        //get the minimum bounding box around the drawing 
        const mbb = getMinBox()

        //get image data according to dpi 
        const dpi = window.devicePixelRatio
        const imgData = canvas.contextContainer.getImageData(mbb.min.x * dpi, mbb.min.y * dpi,
                                                      (mbb.max.x - mbb.min.x) * dpi, (mbb.max.y - mbb.min.y) * dpi);
        return imgData
    }

/**
 * Esta función se encarga de solicitar los datos de
 * la imagen una vez obtenidos procede a llamar al 
 * tensor flow con el objetivo de predecir el resultado
 * una vez obtenido obtiene las probabilidades de cada
 * etiqueta sin embargo para una buena ilustración 
 * en un gráfico solo se van a solicitar 5 datos
 */
function getFrame() {
    //make sure we have at least two recorded coordinates 
    if (coords.length >= 2) {

        //get the image data from the canvas 
        const imgData = getImageData()

        //get the prediction 
        const pred = model.predict(preprocess(imgData)).dataSync()

        //find the top 5 predictions 
        const indices = findIndicesOfMax(pred, 5)
        const probs = findTopValues(pred, 5)
        const names = getClassNames(indices)

        //set the table 
        setTable(names, probs)
    }

}

/**
 * Su función es obtener cada una de los 
 * nombres de las clases en su respectivo
 * orden para que contraste con el resultado
 * de la predicción
 */
function getClassNames(indices) {
    var outp = []
    for (var i = 0; i < indices.length; i++)
        outp[i] = classNames[indices[i]]
    return outp
}

/**
 * Su función es cargar el archivo de los
 * nombres de la clase para ello utiliza 
 * ajax como facilitador
 */
async function loadDict() {

    loc = 'class_names.txt'
    
    await $.ajax({
        url: loc,
        dataType: 'text',
    }).done(success);
}

/**
 * Esta función puede describirse como un tipo de
 * subscribe esto por que espera que el ajax cargue 
 * los datos y se encarga de almacenar cada uno en
 * una variable global llamada classNames
 */
function success(data) {
    const lst = data.split(/\n/)
    for (var i = 0; i < lst.length - 1; i++) {
        let symbol = lst[i]
        classNames[i] = symbol
    }
}

/**
 * Su función es muy especifica, pues obtiene
 * los indices de las 5 probabilidades más altas 
 * para ello debe buscar en la lista de los resultados 
 * más altos y almacenar sus índices esto para ser 
 * usados tambien en la busqueda de los nombres de 
 * las clases
 */
function findIndicesOfMax(inp, count) {
    var outp = [];
    for (var i = 0; i < inp.length; i++) {
        outp.push(i); // add index to output array
        if (outp.length > count) {
            outp.sort(function(a, b) {
                return inp[b] - inp[a];
            }); // descending sort the output array
            outp.pop(); // remove the last index (index of smallest element in output array)
        }
    }
    return outp;
}

/**
 * Una vez obtenido los indices previamente se procede
 * a obtener los valores de las predicciones a partir de los 
 * índices obtenidos
 */
function findTopValues(inp, count) {
    var outp = [];
    let indices = findIndicesOfMax(inp, count)
    // show 5 greatest scores
    for (var i = 0; i < indices.length; i++)
        outp[i] = inp[indices[i]]
    return outp
}

/**
 * Antes de ser enviado a predicción es necesario
 * preprocesar la información de la imagen, para 
 * ello Tensor Flow otorga algunas funciones
 * como su conversión a tensor, su ajuste de tamaño,
 * su normalización así como su expansión de dimensiones
 */
function preprocess(imgData) {
    return tf.tidy(() => {
        //convert to a tensor 
        let tensor = tf.browser.fromPixels(imgData, numChannels = 1)
        
        //resize 
        const resized = tf.image.resizeBilinear(tensor, [28, 28]).toFloat()
        
        //normalize 
        const offset = tf.scalar(255.0);
        const normalized = tf.scalar(1.0).sub(resized.div(offset));

        //We add a dimension to get a batch shape 
        const batched = normalized.expandDims(0)
        return batched
    })
}

/**
 * Función inicial que carga los datos del modelo ya sea el
 * json y los nombres de las clases, además llama al modelo 
 * predict y así mismo permite que se pueda dibujar en el canva 
 * y activa el botón de limpiar data
 */
async function start() {  
    //load the model 
    model = await tf.loadLayersModel('model.json')
    //warm up 
    model.predict(tf.zeros([1, 28, 28, 1]))
    //allow drawing on the canvas 
    allowDrawing()
    
    //load the class names
    await loadDict()
}

/**
 * Activa el modo de dibujo libre en el canvas yu habilita
 * el botón para poder limpiar la información del canvas
 */
function allowDrawing() {
    canvas.isDrawingMode = 1;
    $('button').prop('disabled', false);
    var slider = document.getElementById('myRange');
    slider.oninput = function() {
        canvas.freeDrawingBrush.width = this.value;
    };
}

/**
 * Se encarga de limpiar toda información que 
 * esté dentro del canvas
 */
function erase() {
    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    coords = [];
}

start()