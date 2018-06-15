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
 * Initializing the framebuffer and texture
 */
var textureBuffer;
var celTexture;
var depthTexture;

function initTextureBuffers() {

  var textureWidth = gl.viewportWidth;
  var textureHeight= gl.viewportHeight;
  celTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, celTexture);

  const level = 0;
  const internalFormat = gl.RGBA;
  const border = 0;
  const format = gl.RGBA;
  const type = gl.UNSIGNED_BYTE;
  const data = null;
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                textureWidth, textureHeight, border,
                format, type, data);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Create and bind the framebuffer
  textureBuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, textureBuffer);
  textureBuffer.width = textureWidth;
  textureBuffer.height = textureHeight;

  var renderBuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, textureBuffer.width, textureBuffer.height);

  const attachmentPoint = gl.COLOR_ATTACHMENT0;
  const attachLevel = 0;
  gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, celTexture, attachLevel);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderBuffer); //TODO: possibly remove this

  //finished setup, return the binds back to nothing so that there is no unexpected behavior
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

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

var testProgram;

function createOutlineShader(vs_id, fs_id) {
    var shaderProg = createShaderProg(vs_id, fs_id);

    shaderProg.positionLocation = gl.getAttribLocation(shaderProg, "a_position");
    shaderProg.texcoordLocation = gl.getAttribLocation(shaderProg, "a_texCoord");
    shaderProg.olUniform = gl.getUniformLocation(shaderProg, "uOutlineColor");
    shaderProg.celTexture = gl.getUniformLocation(shaderProg, "uCelTexture");
    shaderProg.outlineOnUniform = gl.getUniformLocation(shaderProg, "uOutlineOn");
    shaderProg.depthTexture = gl.getUniformLocation(shaderProg, "uDepthTexture");

    return shaderProg;
}

/*
 * Initializing shaders
 */
var currentProgram;
var lightProgram;
var outlineProgram;

function initShaders() {

    // Cel Outline Program
    outlineProgram = createShaderProg("cel-outline-vs", "cel-outline-fs");

    outlineProgram.vertexPositionAttribute = gl.getAttribLocation(outlineProgram, "aVertexPosition");
    outlineProgram.vertexNormalAttribute = gl.getAttribLocation(outlineProgram, "aVertexNormal");
    gl.enableVertexAttribArray(outlineProgram.vertexPositionAttribute);
    gl.enableVertexAttribArray(outlineProgram.vertexNormalAttribute);


    outlineProgram.pMatrixUniform = gl.getUniformLocation(outlineProgram, "uPMatrix");
    outlineProgram.mvMatrixUniform = gl.getUniformLocation(outlineProgram, "uMVMatrix");
    outlineProgram.nMatrixUniform = gl.getUniformLocation(outlineProgram, "uNMatrix");
    outlineProgram.olUniform = gl.getUniformLocation(outlineProgram, "uOutlineColor");
    outlineProgram.celShadeOnUniform = gl.getUniformLocation(outlineProgram, "uCelShadeOn");
    // outlineProgram.olTUniform = gl.getUniformLocation(outlineProgram, "uOutlineThickness");
    outlineProgram.outlineThicknessUniform = gl.getUniformLocation(outlineProgram, "uOutlineThickness");


    // Cel Shading Program
    currentProgram = createShaderProg("cel-shader-vs", "cel-shader-fs");

    currentProgram.vertexPositionAttribute = gl.getAttribLocation(currentProgram, "aVertexPosition");
    currentProgram.vertexNormalAttribute = gl.getAttribLocation(currentProgram, "aVertexNormal");
    gl.enableVertexAttribArray(currentProgram.vertexPositionAttribute);
    gl.enableVertexAttribArray(currentProgram.vertexNormalAttribute);

    currentProgram.pMatrixUniform = gl.getUniformLocation(currentProgram, "uPMatrix");
    currentProgram.mvMatrixUniform = gl.getUniformLocation(currentProgram, "uMVMatrix");
    currentProgram.nMatrixUniform = gl.getUniformLocation(currentProgram, "uNMatrix");
    currentProgram.lightPosUniform = gl.getUniformLocation(currentProgram, "uLightPos");
    currentProgram.lightPowerUniform = gl.getUniformLocation(currentProgram, "uLightPower");
    currentProgram.kdUniform = gl.getUniformLocation(currentProgram, "uDiffuseColor");
    currentProgram.ksUniform = gl.getUniformLocation(currentProgram, "uSpecularColor");
    currentProgram.celBandUniform = gl.getUniformLocation(currentProgram, "uCelBand");
    currentProgram.celShadeOnUniform = gl.getUniformLocation(currentProgram, "uCelShadeOn");

    // Initializing light source drawing shader
    lightProgram = createShaderProg("shader-vs-light", "shader-fs-light");
    lightProgram.vertexPositionAttribute = gl.getAttribLocation(lightProgram, "aVertexPosition");
    gl.enableVertexAttribArray(lightProgram.vertexPositionAttribute);
    lightProgram.pMatrixUniform = gl.getUniformLocation(lightProgram, "uPMatrix");

    testProgram = createOutlineShader("vs-outline-on", "fs-outline-on");
}


/*
 * Initializing buffers
 */
var lightPositionBuffer;
var outlineBuffer;
function initBuffers() {
    lightPositionBuffer = gl.createBuffer();
    outlineBuffer = gl.createBuffer();
}


function setRectangle(gl, x, y, width, height) {
  var x1 = x;
  var x2 = x + width;
  var y1 = y;
  var y2 = y + height;
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
     x1, y1,
     x2, y1,
     x1, y2,
     x1, y2,
     x2, y1,
     x2, y2,
  ]), gl.STATIC_DRAW);
}

function drawBufferToCanvas() {
  // Create a buffer to put three 2d clip space points in
  var positionBuffer = gl.createBuffer();

  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Set a rectangle the same size as the image.
  setRectangle(gl, 0, 0, textureBuffer.width, textureBuffer.height);

  // provide texture coordinates for the rectangle.
  var texcoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0.0,  0.0,
    1.0,  0.0,
    0.0,  1.0,
    0.0,  1.0,
    1.0,  0.0,
    1.0,  1.0,
  ]), gl.STATIC_DRAW);

  // Tell WebGL how to convert from clip space to pixels
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.useProgram(testProgram);

  gl.uniform3fv(testProgram.olUniform, outlineColor);
  gl.uniform1i(testProgram.outlineOnUniform, outlineOn);


  // Turn on the position attribute
  gl.enableVertexAttribArray(testProgram.positionLocation);

  // Bind the position buffer.
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(testProgram.positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Turn on the texcoord attribute
  gl.enableVertexAttribArray(testProgram.texcoordLocation);

  // Bind the position buffer.
  gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
  gl.vertexAttribPointer(testProgram.texcoordLocation, 2, gl.FLOAT, false, 0, 0);

  // lookup uniforms
  var resolutionLocation = gl.getUniformLocation(testProgram, "u_resolution");
  gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
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
var outlineThickness = 1;                       // Ambient
var specularColor = [1.0, 1.0, 1.0];            // Specular Color
var celBand = 3;                                // Number of Bands for Cel Shading
var celShadeOn = 0;                             // Determines if Cel Shading is enabled
var outlineOn = 0;
var outlineColor = [0.0, 0.0, 0.0];
var outlineThickness = 2;

// Animation related variables
var rotY = 0.0;                                 // object rotation
var rotY_light = 0.0;                           // light position rotation
var draw_outline = false;
var draw_light = false;


function drawScene() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, textureBuffer);

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

    // Cel Outline Uniforms - DID NOT WORK
    // if (draw_outline) {
      // gl.enable(gl.CULL_FACE);
      // gl.cullFace(gl.FRONT);
      //
      // gl.useProgram(outlineProgram);
      //
      // gl.enableVertexAttribArray(outlineProgram.vertexPositionAttribute);
      // gl.enableVertexAttribArray(outlineProgram.vertexNormalAttribute);
      //
      // gl.uniformMatrix4fv(outlineProgram.pMatrixUniform, false, pMatrix);
      // gl.uniformMatrix4fv(outlineProgram.mvMatrixUniform, false, mvMatrix);
      // var nMatrix = mat4.transpose(mat4.inverse(mvMatrix));
      // gl.uniformMatrix4fv(outlineProgram.nMatrixUniform, false, nMatrix);
      //
      // gl.uniform3fv(outlineProgram.olUniform, outlineColor);
      // gl.uniform1i(outlineProgram.celShadeOnUniform, celShadeOn);
      // gl.uniform1f(outlineProgram.outlineThicknessUniform, outlineThickness);
      //
      // gl.bindBuffer(gl.ARRAY_BUFFER, currentMesh.vertexBuffer);
      // gl.vertexAttribPointer(outlineProgram.vertexPositionAttribute, currentMesh.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
      //
      // gl.bindBuffer(gl.ARRAY_BUFFER, currentMesh.normalBuffer);
      // gl.vertexAttribPointer(outlineProgram.vertexNormalAttribute, currentMesh.normalBuffer.itemSize, gl.FLOAT, false, 0, 0);
      //
      // gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, currentMesh.indexBuffer);
      //
      // gl.drawElements(gl.TRIANGLES, currentMesh.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
      //
      // gl.disableVertexAttribArray(outlineProgram.vertexPositionAttribute);
      // gl.disableVertexAttribArray(outlineProgram.vertexNormalAttribute);
      //
      // gl.disable(gl.CULL_FACE);
    // }

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


    if (draw_light) {
      gl.useProgram(lightProgram);
      gl.uniformMatrix4fv(lightProgram.pMatrixUniform, false, pMatrix);

      gl.bindBuffer(gl.ARRAY_BUFFER, lightPositionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(lightPos), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(lightProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.POINTS, 0, 1);
    }


    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, celTexture);
    //gl.bind

    drawBufferToCanvas();
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
    initTextureBuffers(); //TODO: this is new
    initMesh();
    initShaders();
    initBuffers();

    gl.clearColor(0.3, 0.3, 0.3, 1.0);
    gl.enable(gl.DEPTH_TEST);

    tick();
}
