/*
 * Initializing GL object
 */
var gl;
function initGL(canvas) {
    try {
        gl = canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) {
    }
    if ( !gl ) alert("Could not initialise WebGL, sorry :-(");

    gl = WebGLDebugUtils.makeDebugContext(gl, throwOnGLError, validateNoneOfTheArgsAreUndefined);
}


/*
 * Initializing object geometries
 */
var meshes, meshTransforms;
var currentMesh, currentTransform;
function initMesh() {
    // Load object meshes
    meshes = [
        new OBJ.Mesh(teapot_mesh_str),
        new OBJ.Mesh(bunny_mesh_str)
    ];
    OBJ.initMeshBuffers(gl, meshes[0]);
    OBJ.initMeshBuffers(gl, meshes[1]);

    currentMesh = meshes[0];

    meshTransforms = [mat4.create(), mat4.create()];

    // Set per-object transforms to make them better fitting the viewport
    mat4.identity(meshTransforms[0]);
    mat4.rotateX(meshTransforms[0], -1.5708);
    mat4.scale(meshTransforms[0], [0.15, 0.15, 0.15]);

    mat4.identity(meshTransforms[1]);
    mat4.translate(meshTransforms[1], [0.5, 0, 0]);

    currentTransform = meshTransforms[0];
}

function getShader(id) {
    var script = document.getElementById(id);
    if (!script) {
        return null;
    }

    var string = "";
    var fc = script.firstChild;
    while (fc) {
        if (fc.nodeType == 3) {
            string += fc.textContent;
        }

        fc = fc.nextSibling;
    }

    var shader;
    if (script.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    }
    else if (script.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    }
    else {
        return null;
    }

    gl.shaderSource(shader, string);
    gl.compileShader(shader);

    return shader;
}

/*
 * Initializing shaders
 */
var currentProgram;
var lightProgram;
var outlineProgram;

function initShaders() {

    // Cel Outline Program
    var Ovs = getShader("cel-outline-vs");
    var Ofs = getShader("cel-outline-fs");

    outlineProgram = gl.createProgram();
    gl.attachShader(outlineProgram, Ovs);
    gl.attachShader(outlineProgram, Ofs);
    gl.linkProgram(outlineProgram);
    gl.deleteShader(Ovs);
    gl.deleteShader(Ofs);

    outlineProgram.vertexPositionAttribute = gl.getAttribLocation(outlineProgram, "aVertexPosition");
    outlineProgram.vertexNormalAttribute = gl.getAttribLocation(outlineProgram, "aVertexNormal");

    outlineProgram.pMatrixUniform = gl.getUniformLocation(outlineProgram, "uPMatrix");
    outlineProgram.mvMatrixUniform = gl.getUniformLocation(outlineProgram, "uMVMatrix");
    outlineProgram.nMatrixUniform = gl.getUniformLocation(outlineProgram, "uNMatrix");
    outlineProgram.celShadeOnUniform = gl.getUniformLocation(outlineProgram, "uCelShadeOn");

    // Cel Shading Program
    var Cvs = getShader("cel-shader-vs");
    var Cfs = getShader("cel-shader-fs");

    currentProgram = gl.createProgram();
    gl.attachShader(currentProgram, Cvs);
    gl.attachShader(currentProgram, Cfs);
    gl.linkProgram(currentProgram);
    gl.deleteShader(Cvs);
    gl.deleteShader(Cfs);

    currentProgram.vertexPositionAttribute = gl.getAttribLocation(currentProgram, "aVertexPosition");
    currentProgram.vertexNormalAttribute = gl.getAttribLocation(currentProgram, "aVertexNormal");

    currentProgram.pMatrixUniform = gl.getUniformLocation(currentProgram, "uPMatrix");
    currentProgram.mvMatrixUniform = gl.getUniformLocation(currentProgram, "uMVMatrix");
    currentProgram.nMatrixUniform = gl.getUniformLocation(currentProgram, "uNMatrix");
    currentProgram.lightPosUniform = gl.getUniformLocation(currentProgram, "uLightPos");
    currentProgram.lightPowerUniform = gl.getUniformLocation(currentProgram, "uLightPower");
    currentProgram.kdUniform = gl.getUniformLocation(currentProgram, "uDiffuseColor");
    currentProgram.ambientUniform = gl.getUniformLocation(currentProgram, "uAmbient");
    currentProgram.ksUniform = gl.getUniformLocation(currentProgram, "uSpecularColor");
    currentProgram.celBandUniform = gl.getUniformLocation(currentProgram, "uCelBand");
    currentProgram.celShadeOnUniform = gl.getUniformLocation(currentProgram, "uCelShadeOn");

    // Initializing light source drawing shader
    lightProgram = createShaderProg("shader-vs-light", "shader-fs-light");
    lightProgram.vertexPositionAttribute = gl.getAttribLocation(lightProgram, "aVertexPosition");
    gl.enableVertexAttribArray(lightProgram.vertexPositionAttribute);
    lightProgram.pMatrixUniform = gl.getUniformLocation(lightProgram, "uPMatrix");
}


/*
 * Initializing buffers
 */
var lightPositionBuffer;
function initBuffers() {
    lightPositionBuffer = gl.createBuffer();
}


/*
 * Main rendering code
 */

// Basic rendering parameters
var mvMatrix = mat4.create();                   // Model-view matrix for the main object
var pMatrix = mat4.create();                    // Projection matrix

// Lighting control
var lightMatrix = mat4.create();                // Model-view matrix for the point light source
var lightPos = vec3.create();                   // Camera-space position of the light source
var lightPower = 5.0;                           // "Power" of the light source

// Common parameters for shading models
var diffuseColor = [0.2392, 0.5216, 0.7765];    // Diffuse color
var ambientIntensity = 0.1;                     // Ambient
var specularColor = [1.0, 1.0, 1.0];            // Specular Color
var celBand = 4;                                // Number of Bands for Cel Shading
var celShadeOn = 0;                             // Determines if Cel Shading is enabled
var outlineColor = [1.0, 1.0, 1.0];

// Animation related variables
var rotY = 0.0;                                 // object rotation
var rotY_light = 0.0;                           // light position rotation
var draw_outline = false;


function drawScene() {
    gl.clear( gl.COLOR_BUFFER_BIT |  gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

    mat4.perspective(35, gl.viewportWidth/gl.viewportHeight, 0.1, 1000.0, pMatrix);

    mat4.identity(lightMatrix);
    mat4.translate(lightMatrix, [0.0, -1.0, -7.0]);
    mat4.rotateX(lightMatrix, 0.3);
    mat4.rotateY(lightMatrix, rotY_light);

    lightPos.set([0.0, 2.5, 3.0]);
    mat4.multiplyVec3(lightMatrix, lightPos);

    mat4.identity(mvMatrix);
    mat4.translate(mvMatrix, [0.0, -1.0, -7.0]);
    mat4.rotateX(mvMatrix, 0.3);
    mat4.rotateY(mvMatrix, rotY);
    mat4.multiply(mvMatrix, currentTransform);

    // Cel Outline Uniforms
    if (draw_outline) {
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.FRONT);
      gl.useProgram(outlineProgram);

      gl.enableVertexAttribArray(outlineProgram.vertexPositionAttribute);
      gl.enableVertexAttribArray(outlineProgram.vertexNormalAttribute);

      gl.uniformMatrix4fv(outlineProgram.pMatrixUniform, false, pMatrix);
      gl.uniformMatrix4fv(outlineProgram.mvMatrixUniform, false, mvMatrix);
      var nMatrix = mat4.transpose(mat4.inverse(mvMatrix));
      gl.uniformMatrix4fv(outlineProgram.nMatrixUniform, false, nMatrix);

      gl.uniform1i(outlineProgram.celShadeOnUniform, celShadeOn);

      gl.bindBuffer(gl.ARRAY_BUFFER, currentMesh.vertexBuffer);
      gl.vertexAttribPointer(outlineProgram.vertexPositionAttribute, currentMesh.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, currentMesh.normalBuffer);
      gl.vertexAttribPointer(outlineProgram.vertexNormalAttribute, currentMesh.normalBuffer.itemSize, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, currentMesh.indexBuffer);

      gl.drawElements(gl.TRIANGLES, currentMesh.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

      gl.disableVertexAttribArray(outlineProgram.vertexPositionAttribute);
      gl.disableVertexAttribArray(outlineProgram.vertexNormalAttribute);

      gl.disable(gl.CULL_FACE);
    }

    // Cel Shading Uniforms
    gl.useProgram(currentProgram);

    gl.enableVertexAttribArray(currentProgram.vertexPositionAttribute);
    gl.enableVertexAttribArray(currentProgram.vertexNormalAttribute);

    gl.uniformMatrix4fv(currentProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(currentProgram.mvMatrixUniform, false, mvMatrix);
    var nMatrix = mat4.transpose(mat4.inverse(mvMatrix));
    gl.uniformMatrix4fv(currentProgram.nMatrixUniform, false, nMatrix);

    gl.uniform3fv(currentProgram.lightPosUniform, lightPos);
    gl.uniform1f(currentProgram.lightPowerUniform, lightPower);
    gl.uniform3fv(currentProgram.kdUniform, diffuseColor);
    gl.uniform1f(currentProgram.ambientUniform, ambientIntensity);
    gl.uniform1i(currentProgram.celBandUniform, celBand);
    gl.uniform1i(currentProgram.celShadeOnUniform, celShadeOn);

    gl.bindBuffer(gl.ARRAY_BUFFER, currentMesh.vertexBuffer);
    gl.vertexAttribPointer(currentProgram.vertexPositionAttribute, currentMesh.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, currentMesh.normalBuffer);
    gl.vertexAttribPointer(currentProgram.vertexNormalAttribute, currentMesh.normalBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, currentMesh.indexBuffer);

    gl.drawElements(gl.TRIANGLES, currentMesh.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

    gl.disableVertexAttribArray(currentProgram.vertexPositionAttribute);
    gl.disableVertexAttribArray(currentProgram.vertexNormalAttribute);
}

var lastTime = 0;
var rotSpeed = 60, rotSpeed_light = 60;
var animated = false, animated_light = false;
function tick() {
    requestAnimationFrame(tick);

    var timeNow = new Date().getTime();
    if ( lastTime != 0 ) {
      var elapsed = timeNow - lastTime;
      if ( animated )
        rotY += rotSpeed*0.0175*elapsed/1000.0;
      if ( animated_light )
        rotY_light += rotSpeed_light*0.0175*elapsed/1000.0;
    }
    lastTime = timeNow;

    drawScene();
}

function webGLStart() {
    var canvas = $("#canvas0")[0];

    initGL(canvas);
    initMesh();
    initShaders();
    initBuffers();

    gl.clearColor(0.3, 0.3, 0.3, 1.0);
    gl.enable(gl.DEPTH_TEST);

    tick();
}
