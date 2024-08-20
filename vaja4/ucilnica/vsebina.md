# Teksturiranje

V tej vaji bomo na 3D model nalepili 2D **teksturo**.
[Teksture](https://www.w3.org/TR/webgpu/#gputexture) so lahko različnih
[razsežnosti](https://www.w3.org/TR/webgpu/#enumdef-gputexturedimension) in
[formatov](https://www.w3.org/TR/webgpu/#enumdef-gputextureformat) ter lahko
vsebujejo več nivojev
[piramide slik](https://www.w3.org/TR/webgpu/#mipmap-level) (mipmap level).
Podatki v teksturi so zapisani s **teksli**, katerih vrednosti **vzorčimo**
(sample) z **vzorčevalnikom** (sampler) na podanih **teksturnih koordinatah**
(texture coordinates, UV coordinates), ki določajo točko v **teksturnem
prostoru** (texture space).

### Prenos s strežnika

V prvem koraku izberemo sliko in jo shranimo v direktorij aplikacije pod imenom
`image.png`. Slika naj ne bo prevelika, tako v smislu ločljivosti kot velikosti
datoteke. Za večino primerov uporabe bo dovolj slika ločljivosti 512x512
pikslov. Ločljivost je lahko poljubna, zaradi učinkovitosti pomnilniških
dostopov pa se je najbolje držati potenc števila 2.

V datoteki `main.js` sliko najprej prenesemo s strežnika:

```js
const imageBitmap = await fetch('image.png')
    .then(response => response.blob())
    .then(blob => createImageBitmap(blob));
```

V zgornji kodi iz strežnikovega odgovora izluščimo vsebino v binarni obliki in
jo nato dekodiramo s funkcijo `createImageBitmap`, ki datoteko izbranega
slikovnega formata pretvori v nestisnjeno obliko, ki je primerna za prenos na
grafično kartico.

### Ustvarjanje teksture

Sliko po prenosu s strežnika prenesemo na grafično kartico. V ta namen moramo
najprej ustvariti teksturo primerne velikosti in primernega formata, pri tem pa
sporočiti še njeno uporabo:

```js
const texture = device.createTexture({
    size: [imageBitmap.width, imageBitmap.height],
    format: 'rgba8unorm',
    usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.COPY_DST,
});
```

V zgornji kodi velikost teksture preberemo kar iz slike, ki smo jo prenesli s
strežnika. Za format smo izbrali `rgba8unorm`, ki teksturi dodeli štiri barvne
kanale, pri čemer vsakega od njih predstavimo z 8-bitnim nepredznačenim celim
številom. Pripona `norm` bo pomembna v senčilniku, kjer bodo razpon izbranega
podatkovnega tipa preslikan v enotski interval v obliki števila s plavajočo
vejico. Ker bomo teksturo uporabljali v senčilniku, moramo sporočiti uporabo
`TEXTURE_BINDING`. Za prenos slike iz glavnega pomnilnika sta potrebni še
zastavici `RENDER_ATTACHMENT` in `COPY_DST`, ki ju potrebuje funkcija
`copyExternalImageToTexture`, uporabljena v nadaljevanju.

V naslednjem koraku sliko prenesemo iz glavnega pomnilnika v teksturo v
grafičnem pomnilniku:

```js
device.queue.copyExternalImageToTexture(
    { source: imageBitmap },
    { texture },
    [imageBitmap.width, imageBitmap.height]);
```

Trije parametri zgornjega ukaza predstavljajo izvor in ponor podatkov ter
velikost območja slike, ki ga želimo prenesti. Pri tem imamo natančen nadzor nad
območji izvora in ponora ter morebitnimi barvnimi pretvorbami, ki jih po
potrebi izvede brskalnik pri prenosu podatkov. V zgornji kodi se v veliki meri
zanašamo na privzete nastavitve, ki so prilagojene za prenos 2D barvnih slik.

### Vzorčevalnik

Teksturo bomo uporabili v senčilniku fragmentov, kjer bomo iz nje vzorčili
barvo. Vzorčenje teksture je prilagodljivo prek vzorčevalnika, ki določa
vzorčenje na robovih teksture in interpolacijo podatkov.

Ustvarimo vzorčevalnik s privzetimi nastavitvami:

```js
const sampler = device.createSampler();
```

### Povezava s senčilnikom

V senčilniku dodamo teksturo in vzorčevalnik kot zunanja vira, tako da jima
dodelimo skupino in številko vezave:

```rust
@group(0) @binding(1) var baseTexture: texture_2d<f32>;
@group(0) @binding(2) var baseSampler: sampler;
```

Uporabili smo kar isto skupino kot za uniformo iz ene od prejšnjih vaj. Tip
teksture (`texture_2d<f32>`) odraža njeno razsežnost in podatkovni tip, medtem
ko za navadne vzorčevalnike obstaja le en tip (`sampler`).

Teksturo in vzorčevalnik nato vključimo še v skupino vezav in pri tem uporabimo
pripadajoče številke vezav:

```js
{ binding: 1, resource: texture.createView() },
{ binding: 2, resource: sampler },
```

V senčilniku fragmentov namesto interpolirane barve zdaj lahko uporabimo barvo,
ki jo vzorčimo iz teksture s funkcijo `textureSample`:

```rust
output.color = textureSample(baseTexture, baseSampler, vec2(0, 0));
```

Pri tem sporočimo teksturo, ki jo želimo vzorčiti, vzorčevalnik, ki ga želimo
pri tem uporabiti, in teksturne koordinate, ki določajo položaj vzorca v
teksturnem prostoru. Teksturni prostor je normaliziran, tako da je izhodišče v
levem zgornjem kotu teksture, desni spodnji kot pa leži na točki (1, 1).

S temi spremembami bi se morala na zaslonu izrisati enobarvna kocka.

### Teksturne koordinate

Teksturne koordinate bo senčilnik fragmentov prejel iz senčilnika oglišč, kamor
jih bomo poslali prek atributa. V ta namen bomo nadomestili atribut barve s
teksturnimi koordinatami. Najprej spremenimo podatke oglišč:

```js
const vertices = new Float32Array([
    // positions         // texcoords
    -1, -1, -1,  1,      0,  0,
    -1, -1,  1,  1,      0,  1,
    -1,  1, -1,  1,      1,  0,
    -1,  1,  1,  1,      1,  1,
     1, -1, -1,  1,      0,  0,
     1, -1,  1,  1,      0,  1,
     1,  1, -1,  1,      1,  0,
     1,  1,  1,  1,      1,  1,
]);
```

V skladu s spremembo podatkov posodobimo razpored podatkov:

```js
const vertexBufferLayout = {
    arrayStride: 24,
    attributes: [
        {
            shaderLocation: 0,
            offset: 0,
            format: 'float32x4',
        },
        {
            shaderLocation: 1,
            offset: 16,
            format: 'float32x2',
        },
    ],
};
```

Posodobimo tudi senčilnik, kjer teksturnim koordinatam dodelimo številko
atributa 1 in številko interpoliranke 1 ter tip `vec2f`:

```rust
struct VertexInput {
    @location(0) position: vec4f,
    @location(1) texcoords: vec2f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(1) texcoords: vec2f,
}

struct FragmentInput {
    @location(1) texcoords: vec2f,
}
```

V senčilniku oglišč spremenimo interpolacijo barv v interpolacijo teksturnih
koordinat:

```rust
output.texcoords = input.texcoords;
```

Interpolirane teksturne koordinate nato lahko uporabimo v senčilniku fragmentov
pri vzorčenju teksture:

```rust
output.color = textureSample(baseTexture, baseSampler, input.texcoords);
```

Z zgornjimi spremembami bi morala biti na zaslonu izrisana teksturirana kocka.
Na štirih stranskih ploskvah je del teksture raztegnjen preko celotne ploskve,
kar je posledica slabo nastavljenih teksturnih koordinat. Podatke kocke bi lahko
popravili, toda to bi zahtevalo dodajanje novih oglišč in novih indeksov, saj
morajo v tem primeru različne ploskve, ki si delijo posamezno oglišče, v tem
oglišču uporabljati različne teksturne koordinate. To pa lahko dosežemo le tako,
da ustvarimo več oglišč z enakim položajem in različnimi teksturnimi
koordinatami. Ker bomo v nadaljevanju podatke o ogliščih pridobivali iz zunanjih
datotek, se s tem popravkom na tem mestu ne bomo ukvarjali.

# Težave z vzorčenjem

Odvisno od ločljivosti teksture in njene vsebine lahko na zaslonu opazimo
utripanje barv. Tovrstni artefakti so posledica podvzorčenja, ki ga lahko
obvladamo le z odstranitvijo visokih frekvenc iz teksture. Visoke frekvence
ustrezajo hitrim spremembam v teksturi, kar lahko opazimo na vsaki meji med
teksli.

Težavo lahko do določene mere rešimo z uporabo linearnega filtra:

```js
const sampler = device.createSampler({
    minFilter: 'linear',
    magFilter: 'linear',
});
```

Opazimo, da se barve tekslov zdaj prelivajo med seboj, utripanje barv pa ni
povsem rešeno. Podvzorčenje je namreč posledica transformacij in predvsem
perspektivne projekcije, s katero lahko dosežemo poljubno visoke frekvence pri
izrisu na zaslon. Težavo rešimo s piramido slik postopoma nižjih ločljivosti, ki
vsebujejo postopoma manj podrobnosti in s tem nižje frekvence.

Piramido slik lahko zgradimo ročno ali samodejno. Ročno pomeni, da posamezen
nivo piramide izdelamo z zunanjim programom in ga prenesemo na grafično kartico,
samodejno pa pomeni, da nivoje piramide izdelamo kar neposredno na grafični
kartici z uporabo senčilnika. Skripta za samodejno generiranje piramide slik je
na voljo na [tej povezavi](https://github.com/greggman/webgpu-utils/blob/dev/src/generate-mipmap.ts).
Uporaba je v teh navodilih izpuščena, vsekakor pa je uporaba piramide slik močno
priporočljiva.

# Naloge

1. Popravi podatke oglišč tako, da bo tekstura pravilno preslikana na vsako
ploskev kocke.
2. Napiši funkcijo, ki ustvari teksturo z naključnimi barvami. Ločljivost
teksture naj bo podana kot argument funkcije.
3. Program spremeni tako, da bo hkrati uporabljal tako teksture kot barve oglišč.
V senčilniku fragmentov naj se barvi zmnožita.
4. Program dopolni tako, da bo pri izrisu uporabljal dve teksturi. V senčilniku
fragmentov barvi tekstur povpreči.