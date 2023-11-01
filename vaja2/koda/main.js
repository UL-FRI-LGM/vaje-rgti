// Initialize WebGPU
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });

// Create vertex buffer
const vertices = new Float32Array([
    // position    // color
    -0.5, -0.5,    1, 0, 0, 1,
     0.5, -0.5,    0, 1, 0, 1,
    -0.5,  0.5,    0, 0, 1, 1,
     0.5,  0.5,    1, 1, 0, 1,
]);

const vertexBuffer = device.createBuffer({
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(vertexBuffer, 0, vertices);

// Create index buffer
const indices = new Uint32Array([
    // 1st triangle
    0, 1, 2,
    // 2nd triangle
    2, 1, 3,
]);

const indexBuffer = device.createBuffer({
    size: indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(indexBuffer, 0, indices);

// Fetch and compile shaders
const code = await fetch('shader.wgsl').then(response => response.text());
const module = device.createShaderModule({ code });

// Create the pipeline
const vertexBufferLayout = {
    arrayStride: 24,
    attributes: [
        {
            shaderLocation: 0,
            offset: 0,
            format: 'float32x2',
        },
        {
            shaderLocation: 1,
            offset: 8,
            format: 'float32x4',
        },
    ]
};

const pipeline = device.createRenderPipeline({
    vertex: {
        module,
        entryPoint: 'vertex',
        buffers: [vertexBufferLayout],
    },
    fragment: {
        module,
        entryPoint: 'fragment',
        targets: [{ format }],
    },
    layout: 'auto',
});

// Create uniform buffer
const uniformBuffer = device.createBuffer({
    size: 4 * 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

// Create the bind group
const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
    ]
});

function update() {
    // Animate the square
    const time = performance.now() / 1000;
    const radius = 0.5;
    const frequency = 0.5;
    const x = radius * Math.cos(frequency * time * 2 * Math.PI);
    const y = radius * Math.sin(frequency * time * 2 * Math.PI);

    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        x, y, 0, 1,
    ]));
}

function render() {
    // Render the square
    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: 'clear',
            clearValue: [0.7, 0.8, 0.9, 1],
            storeOp: 'store',
        }]
    });
    renderPass.setPipeline(pipeline);
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setIndexBuffer(indexBuffer, 'uint32');
    renderPass.setBindGroup(0, bindGroup);
    renderPass.drawIndexed(indices.length);
    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
}

function frame() {
    update();
    render();
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
