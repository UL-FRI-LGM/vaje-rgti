const positions = array<vec2f, 3>(
    vec2(-0.5, -0.5),
    vec2( 0.5, -0.5),
    vec2( 0.0,  0.5),
);

const colors = array<vec4f, 3>(
    vec4(1, 0, 0, 1),
    vec4(0, 1, 0, 1),
    vec4(0, 0, 1, 1),
);

struct VertexInput {
    @builtin(vertex_index) vertexIndex: u32,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f, // value before interpolation
}

struct FragmentInput {
    @location(0) color: vec4f, // value after interpolation
}

struct FragmentOutput {
    @location(0) color: vec4f, // note, the output location is in no way related to the interpolant location
}

@vertex
fn vertex(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    output.position = vec4(positions[input.vertexIndex], 0, 1);
    output.color = colors[input.vertexIndex];

    return output;
}

@fragment
fn fragment(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    output.color = input.color;

    return output;
}
