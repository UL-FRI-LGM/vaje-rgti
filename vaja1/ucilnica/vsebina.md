# WebGPU

WebGPU je spletni vmesnik za dostop do grafične strojne opreme. Kot naslednik
vmesnika WebGL je bolj zmogljiv, vsebuje več funkcionalnosti in omogoča pisanje
bolj berljive kode brez raznovrstnih pasti, ki so še kako prisotne v WebGL.
WebGPU je v zasnovi podoben sodobnim grafičnim vmesnikom za razvoj namiznih
aplikacij. V primerjavi z WebGL se bistveno bolje prilagaja arhitekturi sodobnih
grafičnih kartic, zato je ob spretni uporabi njegovo delovanje hitrejše in
bolj predvidljivo. WebGPU poleg izrisa omogoča tudi splošno računanje preko
računskih senčilnikov, kar je še posebej dobrodošlo v aplikacijah, ki se denimo
zanašajo na hitro izvajanje nevronskih mrež.

# Postavitev okolja

Potrebovali bomo:
- **Sodoben spletni brskalnik** (trenutno Chromium in njegovi derivati (Chrome,
Opera, Edge) najbolje podpirajo standard WebGPU)
- **Urejevalnik kode** (priporočamo Sublime Text ali Visual Studio Code)
- **HTTP strežnik** (najenostavneje `python -m http.server`, sicer pa bo deloval
katerikoli strežnik)

Ustvarimo direktorij `koda`.

V direktoriju `koda` ustvarimo datoteko `index.html` z vsebino
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Vaja 1</title>
    <script type="module" src="main.js"></script>
</head>
<body>
    <h1>Vaja 1</h1>
</body>
</html>
```

V direktoriju `koda` ustvarimo prazno datoteko `main.js`. V to datoteko bomo
pisali JavaScript kodo za dostop do WebGPU.

V direktoriju `koda` odpremo terminal in poženemo ukaz 

```console
python -m http.server 3000
```

Ukaz bo pognal HTTP strežnik na lokalnem naslovu (`localhost`) na vratih 3000,
kamor bo stregel vsebino direktorija, v katerem je bil ukaz pognan. Zdaj lahko
spletni brskalnik usmerimo na naslov `localhost:3000` in prikaže se spletna
stran z napisom **Vaja 1**. Odprimo še razvojno orodje (bližnjica v Chromiumu je
F12), kjer bi morali videti konzolo brez napak.

# Inicializacija vmesnika

### Adapter

Najprej bomo potrebovali **adapter**, ki v grobem predstavlja fizično napravo.

```js
const adapter = await navigator.gpu.requestAdapter();
```

Pri izbiri adapterja lahko po potrebi prioritiziramo nižjo porabo energije ali
hitrejše delovanje, če imamo na voljo več grafičnih kartic (na primer integrirano
in diskretno). V zgornjem primeru funkciji ne podamo argumenta in s tem izbiro
prepustimo brskalniku.

Izbira adapterja je lahko časovno potratna operacija, zato je asinhrona.
Na rezultat asinhrone operacije v JavaScriptu počakamo z operatorjem `await`.

### Naprava

Po izbiri adapterja bomo zahtevali dostop do **naprave** (device), ki predstavlja
glavno vstopno točko do funkcionalnosti WebGPU.

```js
const device = await adapter.requestDevice();
```

Naprava je zadolžena za ustvarjanje in upravljanje z resursi. Pri izbiri naprave
lahko zahtevamo uporabo razširitev ali višjih numeričnih limitov, toda s tem
zmanjšamo nabor naprav, na katerih bo naša aplikacija delovala (v prvi vrsti
odpadejo mobilne naprave).

Tudi izbira naprave je lahko časovno potratna operacija, zato je asinhrona.

### Platno

V datoteki `index.html` izbrišimo element `<h1>` in dodajmo element `canvas` s
fiksno velikostjo 512x512 pikslov:

```html
<canvas width="512" height="512"></canvas>
```

Element `canvas` je platno, na katerega bo WebGPU risal geometrijo. WebGPU lahko
uporabljamo tudi brez platna, če potrebujemo le njegove računske sposobnosti.
Za risanje na platno moramo najprej konfigurirati povezavo med platnom in napravo.
Na posamezno platno je lahko v danem trenutku povezana le ena naprava, medtem ko
ena naprava lahko riše na več platen. Povezavo ustvarimo v `main.js` prek konteksta
`webgpu`. Pri tem moramo določiti format barve, ki se bo uporabljal pri izrisu.
Običajno je na vsaki napravi en format še posebej učinkovit. Za kateri format gre,
lahko vprašamo WebGPU.

```js
const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });
```

# Brisanje platna

Vse ukaze, vključno z ukazi za upodabljanje, moramo napravi podati v razumljivi
obliki. To storimo z **ukaznim kodirnikom** (command encoder), ki želene ukaze
zapiše v **ukazni medpomnilnik** (command buffer), tega pa oddamo napravi v
izvedbo preko **ukazne vrste** (command queue).

```js
const commandEncoder = device.createCommandEncoder();
// here encode commands
const commandBuffer = commandEncoder.finish();
device.queue.submit([commandBuffer]);
```

Pred vsakim izrisom moramo platno najprej pobrisati. Brisanje platna je torej
prva operacija **obhoda upodabljanja** (render pass).

```js
// encode commands
const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        clearValue: [0.7, 0.8, 0.9, 1],
        storeOp: 'store',
    }]
});
renderPass.end();
```

V zgornjem primeru obhod upodabljanja zaključimo takoj po začetku, brez ukazov
za izris. Napravi povemo, da naj na začetku obhoda upodabljanja pobriše platno
(`loadOp: 'clear'`) z določeno barvo (`clearValue: [0.7, 0.8, 0.9, 1]`),
na koncu obhoda pa vse rezultate upodabljanja shrani (`storeOp: 'store'`).

V določenih primerih uporabe lahko na začetku obhoda namesto brisanja naložimo
vrednosti iz prejšnjega obhoda upodabljanja (`loadOp: 'load'`), na koncu obhoda
pa jih lahko zavržemo (`storeOp: 'discard'`). Te primere uporabe bomo spoznali
na kasnejših vajah.

# Rdeč trikotnik

Za izris trikotnika potrebujemo dva programa: prvi, **senčilnik oglišč**, določi
položaj oglišč trikotnika na platnu, drugi, **senčilnik fragmentov**, pa določi
barvo pikslov (natančneje fragmentov). V kakšni obliki podatki o ogliščih pridejo
v obdelavo v senčilnik oglišč in v kakšni obliki so zapisane barve na izhodu
senčilnika fragmentov, določa **cevovod**. Cevovod torej oba senčilnika poveže v
skupno celoto in določi format podatkov na vhodu in izhodu. Zaradi učinkovitosti
je pomembno, da te informacije grafični kartici podamo vnaprej.

### Senčilniki

Ustvarimo datoteko `shader.wgsl`, kamor bomo pisali izvorno kodo senčilnikov
v jeziku WGSL (WebGPU Shading Language).

Ustvarimo dve funkciji, `vertex` in `fragment`:

```rust
fn vertex() -> vec4f {
    return vec4(0, 0, 0, 1);
}

fn fragment() -> vec4f {
    return vec4(1, 0, 0, 1);
}
```

Zgornja koda se bo sicer prevedla, toda za uporabo funkcij v vlogi senčilnika
oglišč in senčilnika fragmentov moramo upoštevati nekaj osnovnih pravil:
- Senčilnik oglišč mora biti dekoriran z dekoratorjem `@vertex`
- Senčilnik fragmentov mora biti dekoriran z dekoratorjem `@fragment`
- Senčilnik oglišč mora položaj posameznega oglišča zapisati v vgrajeno
spremenljivko `position`
- Senčilnik fragmentov mora barvo posameznega fragmenta zapisati v izhodno sliko,
določeno z indeksom (seznam izhodnih slik bomo podali pri konfiguraciji cevovoda)

Z dodanimi dekoratorji bo koda senčilnikov izgledala tako:

```rust
@vertex
fn vertex() -> @builtin(position) vec4f {
    return vec4(0, 0, 0, 1);
}

@fragment
fn fragment() -> @location(0) vec4f {
    return vec4(1, 0, 0, 1);
}
```

V datoteki `main.js` moramo kodo senčilnikov najprej pridobiti s strežnika,
za kar uporabimo asinhrono funkcijo `fetch`, iz odgovora strežnika pa
izluščimo vsebino v obliki besedila:

```js
const code = await fetch('shader.wgsl').then(response => response.text());
```

Senčilnike prevedemo s klicem funkcije `createShaderModule`:

```js
const module = device.createShaderModule({ code });
```

### Cevovod

Senčilnike in obliko vhodnih in izhodnih podatkov določimo v **cevovodu**.
Ustvarjanje cevovoda zahteva veliko dela od gonilnika, saj mora celotno
konfiguracijo temeljito validirati, da med izvajanjem ne pride do raznovrstnih
napak. Cevovode zato vedno ustvarimo vnaprej in ne v zadnjem trenutku pred
prvo uporabo. Obstajata dve vrsti cevovoda, grafični in računski. Na vajah
bomo uporabljali le grafičnega.

```js
const pipeline = device.createRenderPipeline({
    vertex: {
        module,
        entryPoint: 'vertex',
    },
    fragment: {
        module,
        entryPoint: 'fragment',
        targets: [{ format }],
    },
    layout: 'auto',
});
```

V zgornjem primeru določimo senčilniški modul in ime vstopne funkcije za oba
senčilnika. Pri senčnilniku fragmentov moramo določiti tudi format izhodnih slik.
Indeks 0 v dekoratorju `@location(0)` se nanaša na ta seznam. Zadnji podatek pri
ustvarjanju cevovoda je razpored cevovoda (pipeline layout), ki ga bomo
obravnavali na kasnejših vajah. Do nadaljnjega bomo ustvarjanje razporeda
cevovoda prepustili gonilniku, ki razpored izlušči iz same kode senčilnikov,
toda to lahko privede do raznovrstnih težav, zato je v praksi priporočljivo
ročno ustvarjanje razporeda.

### Obhod upodabljanja

V obhodu upodabljanja moramo določiti cevovod in izstaviti klic izrisa (draw
call):

```js
renderPass.setPipeline(pipeline);
renderPass.draw(3);
```

V zgornjem izrisu smo določili tri oglišča, torej bomo izrisali en trikotnik.

Če kodo poženemo, bomo videli prazno platno. Senčilnik oglišč bo namreč vsem
ogliščem določil enak položaj na platnu. Na nekakšen način moramo razlikovati
med oglišči in jim določiti različne položaje. Najenostavneje to dosežemo prek
vgrajene spremenljivke `vertex_index`, ki bo ogliščem našega trikotnika priredil
indekse 0, 1 in 2. Spremenljivko `vertex_index` lahko v kodo vključimo kot
parameter funkcije `vertex`:

```rust
@vertex
fn vertex(@builtin(vertex_index) vertexIndex) -> @builtin(position) vec4f {
    if (vertexIndex == 0) {
        return vec4(0, 0, 0, 1);
    } else if ( ... ) {
        ...
    }
}
```

Kodo lahko še malenkost poenostavimo z uporabo seznamov:

```rust
const positions = array<vec2f, 3>(
    vec2(-0.5, -0.5),
    vec2( 0.5, -0.5),
    vec2( 0.0,  0.5),
);

@vertex
fn vertex(@builtin(vertex_index) vertexIndex) -> @builtin(position) vec4f {
    return vec4(positions[vertexIndex], 0, 1);
}
```

Posodobljena koda bi morala na platnu izrisati rdeč trikotnik.

# Obarvan trikotnik

Trikotnik bi želeli obarvati tako, da obarvamo vsako oglišče s svojo barvo, v
notranjosti trikotnika pa bi se barve prelivale. Barve lahko ogliščem določimo
na podoben način kot položaje:

```rust
const colors = array<vec4f, 3>(
    vec4(1, 0, 0, 1),
    vec4(0, 1, 0, 1),
    vec4(0, 0, 1, 1),
);
```

Za prelivanje barv v notranjosti trikotnika bomo uporabili eno izmed osnovnih
operacij grafične kartice, **interpolacijo**. Ker je interpolacija tako pogosta
operacija v računalniški grafiki, je zaradi višje učinkovitosti na grafičnih
karticah običajno implementirana kar v strojni opremi. Mi moramo le določiti
spremeljivke, katerih vrednosti želimo interpolirati. Te spremenljivke imenujemo
**interpoliranke**. Njihove vrednosti določimo v senčilniku oglišč, grafična
kartica pa jih interpolira med izrisom na platno. Interpolirane vrednosti nato
prevzame senčilnik fragmentov, ki jih lahko uporabi denimo pri izračunu barve
fragmenta.

Ker funkcije v naših senčilnikih ne morejo vrniti več vrednosti, bomo morali
strukturo programa nekoliko spremeniti. Določili bomo štiri strukture, ki bodo
definirale vhode in izhode senčilnikov:

```rust
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
```

Posodobimo še senčilnika, da bosta uporabljala zgornje strukture:

```rust
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
```

Tako posodobljena koda bi morala brez sprememb v datoteki `main.js` izrisati
trikotnik, v katerem se barve gladko prelivajo med rdečo, zeleno in modro.
