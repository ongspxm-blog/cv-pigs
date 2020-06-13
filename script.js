function $(id) {
    return document.getElementById(id);
}

// === util opencv funcs
function img_findContours(img) {
    if (img.type() > 0) {
        cv.cvtColor(img, img, cv.COLOR_RGBA2GRAY, 0);
        cv.adaptiveThreshold(img, img, 200,
            cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 3, 2);
    }

    const contours = new cv.MatVector();
    const hierachy = new cv.Mat();
    cv.findContours(img, contours, hierachy,
        cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

    return contours;
}

// === algos (colors)
let clrRatio;
function getColors(mask) {
    const img = cv.imread('input');

    const W = 20;
    const H = parseInt(W * img.size().height / img.size().width);
    const size = new cv.Size(W, H);

    cv.resize(img, img, size);
    cv.resize(mask, mask, size);

    const idata = img.data;
    const bmask = mask.data;

    function getVal(data, r, c, channels, i=0) {
        return data[(r*W + c)*channels + i];
    }


    let total = 0;
    const colors = {};

    const bin = 15;
    const binSize = parseInt(255/bin);

    for (let r=0; r<H; r++) {
        for (let c=0; c<W; c++) {
            if(getVal(bmask, r, c, 1)) {
                const color = parseInt(getVal(idata, r, c, 4, 0)/binSize)
                    + parseInt(getVal(idata, r, c, 4, 1)/binSize)*bin
                    + parseInt(getVal(idata, r, c, 4, 2)/binSize)*bin*bin;

                if (colors[color]) {
                    colors[color] += 1;
                } else {
                    colors[color] = 1;
                }

                total += 1;
            }
        }
    }

    const cnts = [];
    const clrs = Object.keys(colors);
    for (i in clrs) {
        const clr = clrs[i];
        const rgb = [
            clr % (bin),
            clr % (bin*bin) / bin,
            clr / (bin*bin)].map(x => parseInt(x*binSize));

        if (!(rgb[0] < 2 && rgb[1] < 2 && rgb[2] < 2
                && colors[clr]<0.2*total)) {
            rgb.push(colors[clr]);
            cnts.push(rgb);
        }
    }

    cnts.sort((rgb1, rgb2) => rgb2[3] - rgb1[3]);
    clrRatio = cnts;
}

// === algos (shapes)
let shape = 0;
let maxWidth = 0;
function initiate() {
    // === write into gloabl shape object
    const src = cv.imread('input');
    const contours = img_findContours(src);

    // === assumes that the boundary of img is a contour
    let img;
    img = cv.Mat.zeros(src.cols, src.rows, cv.CV_8UC1);
    for (let i=1; i<contours.size(); i++) {
        cv.drawContours(img, contours, i, (new cv.Scalar(255)), -1);
    }

    // === close the holes
    const mask = cv.Mat.ones(5, 5, cv.CV_8U);
    cv.morphologyEx(img, img, cv.MORPH_CLOSE, mask);

    // === assume 1 background, and pokemon closed to full shape
    const contours2 = img_findContours(img);

    if (shape) { shape.delete(); }
    shape = contours2.get(0);
    currCnt = 0;

    // === print the starting shape
    const tmp = new cv.MatVector();
    tmp.push_back(shape);
    maxWidth = binSearch(shape);

    img = cv.Mat.zeros(src.cols, src.rows, cv.CV_8UC1);
    cv.drawContours(img, tmp, 0, (new cv.Scalar(255)), -1);
    getColors(img);

    src.delete();
    contours.delete();

    img.delete();
    mask.delete();

    contours2.delete();
    tmp.delete();

    simplify();
}

function binSearch(contour) {
    let low = 0;
    let high = parseInt(cv.arcLength(contour, true));

    const err = 5;
    while (low+err < high) {
        const mid = parseInt((low + high)/2);
        const shape = poly(contour, mid);

        if (shape.size().height > 3) {
            low = mid;
        } else {
            high = mid;
        }
        shape.delete();
    }

    return high;
}

function poly(contour, width) {
    const shape2 = new cv.Mat();

    cv.approxPolyDP(contour, shape2, width, true);
    return shape2;
}

let currCnt = 0;
const maxCnt = 10;
function simplify(val) {
    if (!val) {
        currCnt += 1;
        val = currCnt;
        $('info').innerText = currCnt + ' / ' + maxCnt;
    }

    if (val > maxCnt) {
        val = 1;
        currCnt = 1;
    }

    const shape2 = poly(shape, parseInt(maxWidth * (val/maxCnt)**2));
    const tmp = new cv.MatVector();
    tmp.push_back(shape2);

    const src = cv.imread('input');
    const mask = cv.Mat.zeros(src.cols, src.rows, cv.CV_8UC1);
    cv.drawContours(mask, tmp, 0, [255,255,255,255], -1);

    const rect = cv.boundingRect(shape2);
    const clrs = clrRatio.slice(0, maxCnt-val+1);
    const total = clrs.reduce((val, curr) => val + curr[3], 0);

    let sofar = rect.y;
    for (i in clrs) {
        const clr = clrs[i];

        const p1 = new cv.Point(rect.x, sofar);
        sofar += parseInt(rect.height * clr[3] / total);

        const p2 = new cv.Point(rect.x + rect.width, sofar);
        cv.rectangle(src, p1, p2, [clr[0], clr[1], clr[2], 255], -1);
    }

    let res = cv.Mat.zeros(src.cols, src.rows, cv.CV_8UC3);
    src.copyTo(res, mask);

    cv.drawContours(res, tmp, 0, [0,0,0,255], 3);
    cv.imshow('output', res);

    shape2.delete();
    tmp.delete();
    src.delete();
    mask.delete();
    res.delete();
}

// == UI funcs
function loadImg(url) {
    const img = new Image();
    img.onload = function () {
        const cvs = $('input');
        cvs.width = img.width;
        cvs.height = img.height;

        cvs.getContext('2d').drawImage(
            img, 0, 0, img.width, img.height);
    };

    img.src = url;
}

window.onload = function() {
    $('file').onchange = function() {
        loadImg(URL.createObjectURL(this.files[0]));
    };
};
