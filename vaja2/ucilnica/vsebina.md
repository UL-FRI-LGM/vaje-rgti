# Ločeni atributi oglišč

V prejšnji vaji smo podatke o ogliščih (položaje in barve) zapisali v senčilnik.
Seveda tak pristop ni skalabilen. Podatke bomo zato zapisali v grafični pomnilnik
in jih v senčilnik poslali v obhodu upodabljanja.

### Senčilnik

Najprej v senčilniku oglišč dopolnimo `VertexInput` z dvema novima spremenljivkama:

```rust
struct VertexInput {
    @location(0) position: vec2f,
    @location(1) color: vec4f,
}
```

Posodobiti moramo tudi funkcijo `vertex`:

```rust
output.position = vec4(input.position, 0, 1);
output.color = input.color;
```

Spremenljivke, ki opisujejo posamezno oglišče, imenujemo **atributi**. Naš
senčilnik bo torej sprejel oglišče z dvema atributoma: položajem na lokaciji 0
in barvo na lokaciji 1. Te številke bomo potrebovali pri ustvarjanju cevovoda.

V zgornji kodi opazimo, da smo izbrisali vhodno spremenljivko `vertexIndex`.
Prav tako lahko izbrišemo seznama položajev in barv, saj jih bomo prestavili
v `main.js`. Senčilnik se je s tem bistveno poenostavil.

### Medpomnilniki

Najprej podatke o položajih zapišimo v glavni pomnilnik v `main.js`:

```js
const positions = new Float32Array([
    -0.5, -0.5,
     0.5, -0.5,
     0.0,  0.5,
]);
```

Vidimo, da iz kode ni razvidno, da gre za dvodimenzionalne vektorje. Ta
informacija je del formata podatkov, kar bomo napravi sporočili pri ustvarjanju
cevovoda.

V naslednjem koraku ustvarimo **medpomnilnik** (buffer), ki predstavlja posamezno
alokacijo grafičnega pomnilnika:

```js
const positionBuffer = device.createBuffer({
    size: positions.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
```

Pri ustvarjanju medpomnilnika moramo napravi sporočiti njegovo velikost in
uporabo. Zastavica `VERTEX` napravi sporoča, da bodo podatki iz medpomnilnika
uporabljeni v senčilniku oglišč, za zapisovanje v medpomnilnik pa je dodatno
potrebna zastavica `COPY_DST`.

Ukaz za zapisovanje podatkov v medpomnilnik izstavimo v ukazno vrsto:

```js
device.queue.writeBuffer(positionBuffer, 0, positions);
```

V zgornji vrstici število 0 predstavlja odmik v številu bajtov od začetka
medpomnilnika, kjer bomo začeli pisanje.

Na enak način pripravimo podatke o barvah:

```js
const colors = new Float32Array([
    1, 0, 0, 1,
    0, 1, 0, 1,
    0, 0, 1, 1,
]);

const colorBuffer = device.createBuffer({
    size: colors.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(colorBuffer, 0, colors);
```

### Cevovod

Zdaj se lahko lotimo cevovoda. Pri tem moramo vnaprej sporočiti napravi, kakšne
medpomnilnike bomo uporabljali, kakšen bo format atributov in njihov razpored
znotraj medpomnilnikov ter na katere lokacije v senčilniku bodo podatki vezani.

Najprej ustvarimo opis prvega medpomnilnika, ki vsebuje položaje oglišč:

```js
const positionBufferLayout = {
    arrayStride: 8,
    attributes: [{
        shaderLocation: 0,
        offset: 0,
        format: 'float32x2',
    }]
};
```

Z zgornjim opisom napravi sporočimo, da je v tem medpomnilniku le en atribut, ki
je vezan na lokacijo 0 v senčilniku oglišč, njegovi podatki pa so v medpomnilniku
zapisani kot dvodimenzionalni vektorji 32-bitnih števil s plavajočo vejico.
Položaj prvega oglišča je od začetka medpomnilnika zamaknjen za 0 bajtov, položaj
vsakega naslednjega oglišča pa je zamaknjen za nadaljnjih 8 bajtov.

Podoben opis potrebujemo za drugi medpomnilnik, ki vsebuje barve oglišč:

```js
const colorBufferLayout = {
    arrayStride: 16,
    attributes: [{
        shaderLocation: 1,
        offset: 0,
        format: 'float32x4',
    }]
};
```

Gre torej za medpomnilnik, ki vsebuje en atribut, vezan na lokacijo 1 v senčilniku
oglišč. Njegovi podatki so v medpomnilniku zapisani kot štiridimenzionalni
vektorji 32-bitnih števil s plavajočo vejico. Barva prvega oglišča je od začetka
medpomnilnika zamaknjena za 0 bajtov, barva vsakega naslednjega oglišča pa za
nadaljnjih 16 bajtov.

Zgornja opisa medpomnilnikov napravi podamo ob ustvarjanju cevovoda:

```js
const pipeline = device.createRenderPipeline({
    vertex: {
        module,
        buffers: [positionBufferLayout, colorBufferLayout],
    },
    fragment: {
        module,
        targets: [{ format }],
    },
    layout: 'auto',
});
```

### Obhod upodabljanja

V obhodu upodabljanja moramo po klicu `setPipeline` le še povezati medpomnilnika
s cevovodom:

```js
renderPass.setVertexBuffer(0, positionBuffer);
renderPass.setVertexBuffer(1, colorBuffer);
```

Številke v zgornji kodi se nanašajo na seznam medpomnilnikov v opisu cevovoda,
ne na lokacije atributov v senčilniku.

Tako popravljena koda bi se morala izvesti brez napak in na platno izrisati
enak trikotnik.

# Prepleteni atributi oglišč

V zgornjem primeru smo podatke za posamezno oglišče pridobili iz dveh ločenih
medpomnilnikov. Pri večjem številu oglišč je tak dostop do pomnilnika zelo
potraten zaradi slabega izkoristka predpomnilnika grafične kartice. Boljšo
učinkovitost dosežemo s prepletanjem atributov, tako da so atributi posameznega
oglišča tudi v pomnilniku blizu skupaj.

V `main.js` bomo podatke o ogliščih zapisali v en seznam, imenovan `vertices`:

```js
const vertices = new Float32Array([
    // position    // color
    -0.5, -0.5,    1, 0, 0, 1,
     0.5, -0.5,    0, 1, 0, 1,
     0.0,  0.5,    0, 0, 1, 1,
]);
```

Podatke nato zapišemo v medpomnilnik `vertexBuffer`:

```js
const vertexBuffer = device.createBuffer({
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(vertexBuffer, 0, vertices);
```

Ustvarimo primeren opis medpomnilnika:

```js
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
```

Tokrat sta v medpomnilniku shranjena dva atributa z različnima odmikoma od
začetka medpomnilnika in različnima formatoma. Velikost oglišča se je povečala
na 24 bajtov.

Posodobimo še konfiguracijo senčilnika oglišč v cevovodu:

```js
buffers: [vertexBufferLayout],
```

Temu primerno spremenimo še obhod upodabljanja:

```js
renderPass.setVertexBuffer(0, vertexBuffer);
```

Vse sledove ločenih medpomnilnikov lahko zdaj izbrišemo.

# Indeksiranje

Še zadnja optimizacija bo indeksirano upodabljanje, ki nam omogoča ponovno
uporabo že definiranih oglišč. Za demonstracijo koncepta bomo namesto trikotnika
izrisali kvadrat. Ker je kvadrat sestavljen iz 2 trikotnikov, potrebujemo 6
oglišč, od katerih sta 2 podvojeni:

```js
const vertices = new Float32Array([
    // 1st triangle
    -0.5, -0.5,    1, 0, 0, 1,
     0.5, -0.5,    0, 1, 0, 1,
    -0.5,  0.5,    0, 0, 1, 1,

    // 2nd triangle
    -0.5,  0.5,    0, 0, 1, 1,
     0.5, -0.5,    0, 1, 0, 1,
     0.5,  0.5,    1, 1, 0, 1,
]);
```

V obhodu upodabljanja izrišemo 6 oglišč:

```js
renderPass.draw(6);
```

Le s tema dvema popravkoma bi morala koda izrisati kvadrat.

Podvojevanju oglišč se lahko izognemo tako, da najprej vsako oglišče v
medpomnilniku oglišč definiramo le enkrat:

```js
const vertices = new Float32Array([
    // position    // color
    -0.5, -0.5,    1, 0, 0, 1,
     0.5, -0.5,    0, 1, 0, 1,
    -0.5,  0.5,    0, 0, 1, 1,
     0.5,  0.5,    1, 1, 0, 1,
]);
```

Nato zgradimo še **medpomnilnik indeksov**:

```js
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
```

Pri tem smo uporabili 32-bitna nepredznačena cela števila (`Uint32Array`) in
napravi sporočili, da bo medpomnilnik uporabljen kot medpomnilnik indeksov
(`INDEX`).

Posodobiti moramo še obhod upodabljanja, tako da nastavimo medpomnilnik indeksov
z določenim podatkovnim tipom (`uint32`) in namesto funkcije `draw` kličemo
funkcijo `drawIndexed`, ki ji podamo število indeksov:

```js
renderPass.setIndexBuffer(indexBuffer, 'uint32');
renderPass.drawIndexed(indices.length);
```

Na platnu bi morali videti obarvan kvadrat.

V opisanem primeru gre za nepotrebno optimizacijo, saj je količina podatkov zelo
majhna. Praktični 3D modeli pa posamezno oglišče lahko uporabijo tudi v 6 ali
več trikotnikih, zato je taka optimizacija kritičnega pomena. Vsi modeli, ki jih
bomo uporabljali na vajah, bodo indeksirani.

# Animacija

Če želimo kvadrat programsko animirati, moramo najti način za prenos podatkov o
njegovi transformaciji v senčilnik. Podatki o transformaciji so skupni vsem
ogliščem in vsem fragmentom, zato v senčilniku delujejo podobno kot konstante.
Imenujemo jih **uniforme**. V nasprotju s pravimi konstantami lahko uniforme med
zaporednimi klici izrisa spreminjamo in s tem ustvarimo animacijo.

Uniforme in drugi zunanji viri so organizirani v **skupine**, znotraj skupine pa
ima vsak vir svojo **številko vezave**. Vse vire v posamezni skupini v senčilnik
povežemo z enim samim funkcijskim klicem.

### Senčilnik

Denimo, da želimo kvadratu dodati translacijo, ki jo predstavimo z 2D vektorjem.
Najprej jo dodamo v senčilnik oglišč:

```rust
@group(0) @binding(0) var<uniform> translation: vec2f;
```

Translacijo prištejemo položaju oglišča:

```rust
output.position = vec4(input.position + translation, 0, 1);
```

Translacijo smo v zgornji kodi dodelili skupini 0 in ji določili številko vezave
0. Te številke bodo pomembne pri ustvarjanju skupine vezav.

### Medpomnilnik

Vrednosti uniform senčilnik pridobi iz medpomnilnika. Ustvarimo medpomnilnik, ki
naj bo vsaj tako velik, da lahko hrani dve števili s plavajočo vejico:

```js
const uniformBuffer = device.createBuffer({
    size: 8,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
```

Pri tem smo napravi sporočili, da bo medpomnilnik uporabljen kot uniforma.

### Skupina vezav

Za vezavo medpomnilnika v senčilnik moramo ustvariti še skupino vezav:

```js
const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
    ]
});
```

Razpored uniform v posamezni skupini in njihove tipe določa **razpored skupine**
(bind group layout), razpored vseh skupin v celotnem cevovodu pa določa
**razpored cevovoda**. Stvarjenje slednjega smo v prvi vaji prepustili gonilniku
(`layout: 'auto'`), tako da lahko razpored skupine pridobimo kar prek funkcije
`pipeline.getBindGroupLayout`, ki ji podamo številko skupine. Tako ustvarjena
skupina vezav bo posledično veljavna le v tem cevovodu.

Nazadnje v obhodu upodabljanja skupino povežemo s senčilnikom:

```js
renderPass.setBindGroup(0, bindGroup);
```

### Animacija

Do tega trenutka je naša aplikacija izris izvedla le enkrat, za animacijo pa bo
treba napisati zanko, ki bo najprej posodobila transformacijo kvadrata, nato pa
izrisala posodobljeno sceno. Potrebujemo torej dve funkciji, `update` za
posodabljanje in `render` za izris, ki ju bomo klicali večkrat (običajno
60-krat) na sekundo:

```js
function update() {
    // user input, animations, AI ...
}

function render() {
    // clear the canvas, render
}

function frame() {
    update();
    render();
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

Za implementacijo zanke smo uporabili v brskalnik vgrajeno funkcijo
`requestAnimationFrame`, ki podano funkcijo (`frame`) izvede pred naslednjim
osveževanjem zaslona.

Če želimo, da se kvadrat premika po krožnici, lahko animacijo napišemo tako:

```js
function update() {
    const time = performance.now() / 1000;
    const radius = 0.5;
    const frequency = 0.5;
    const x = radius * Math.cos(frequency * time * 2 * Math.PI);
    const y = radius * Math.sin(frequency * time * 2 * Math.PI);

    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([x, y]));
}
```

### Transformacije z matrikami

Transformacije lahko posplošimo z uporabo matrik. V računalniški grafiki se
najpogosteje uporabljajo realne matrike velikosti 4x4, saj lahko z njimi
predstavimo poljubne afine in celo perspektivne transformacije. Poleg tega lahko
več transformacij združimo v eno samo matriko in s tem še pospešimo izračun.

Najprej v senčilniku zamenjajmo spremenljivko `translation` tipa `vec2f` z
matriko `matrix` tipa `mat4x4f`:


```rust
@group(0) @binding(0) var<uniform> matrix: mat4x4f;
```

Matriko pomnožimo s položajem oglišča:

```rust
output.position = matrix * vec4(input.position, 0, 1);
```

Zdaj lahko translacijo v funkciji `update` nadomestimo z matriko:

```js
device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, 0, 1,
]);
```

Ne pozabimo še povečati velikosti medpomnilnika, ki mora biti zdaj velik vsaj
64 bajtov.

Matrike so na grafični kartici zapisane po stolpcih, zato matrika v zgornjem
zapisu izgleda transponirana.
