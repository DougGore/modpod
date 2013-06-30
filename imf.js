// An 11 octave period table, this is used for look ups
var periodTable = [
//  C     C#    D     D#    E     F     F#    G     G#    A     A#    B
  27392,25856,24384,23040,21696,20480,19328,18240,17216,16256,15360,14496, // 0
  13696,12928,12192,11520,10848,10240, 9664, 9120, 8608, 8128, 7680, 7248, // 1
   6848, 6464, 6096, 5760, 5424, 5120, 4832, 4560, 4304, 4064, 3840, 3624, // 2
   3424, 3232, 3048, 2880, 2712, 2560, 2416, 2280, 2152, 2032, 1920, 1812, // 3
   1712, 1616, 1524, 1440, 1356, 1280, 1208, 1140, 1076, 1016,  960,  906, // 4
    856,  808,  762,  720,  678,  640,  604,  570,  538,  508,  480,  453, // 5
    428,  404,  381,  360,  339,  320,  302,  285,  269,  254,  240,  226, // 6
    214,  202,  190,  180,  170,  160,  151,  143,  135,  127,  120,  113, // 7
    107,  101,   95,   90,   85,   80,   75,   71,   67,   63,   60,   56, // 8
// Special case octaves
     53,   50,   47,   45,   42,   40,   37,   35,   33,   31,   30,   28, // 9
     26,   25,   23,   22,   21,   20,   18,   17,   16,   15,   15,   14  // 10
];

/*
enum FTEnum { AMIGA, LINEAR };
enum NTenum { SAMPLES, INSTRUMENTS };
*/

/*
typedef struct
{
    TEXT *InsName;
    BYTE NoteMap[96];
    WORD VolumeEnv[24];
    WORD PanningEnv[24];
    BYTE NumVolPoints;
    BYTE NumPanPoints;
    bool VolEnvOn;
} _IMFInstrument;
*/

var IMFSample =
{
    sampleName : '',
    sampleLength : 0,
    finetune : 0,
    volume : 0,
    loopStart : 0,
    loopEnd : 0,
    loopMode : 0,
    panning : 0,
    relativeNote : 0,

    sampleRate : 0,
    bits : 0,
    data : null
};

/*
typedef struct
{
    WORD Note;
    BYTE Instrument;
    BYTE Volume;
    BYTE Effect;
    BYTE EffectData;
} _IMFNote;

typedef struct
{
    WORD ChannelHeight;
    _IMFNote *Data;
} _IMFColumn;

typedef struct
{
    BYTE NumChannels;
    _IMFColumn *Columns;
} _IMFPattern;
*/

var imfData =
{
    header :
    {
        // Textual information
        songName : '',
        artistName : '',
        message : '',
        format : null,
        // Quantity info
        numChannels : 0,
        numSamples : 0,
        numPatterns : 0,
        numPositions : 0,
        /*
        // Default mappings
        BYTE ChannelPanning[64];
        BYTE VolumePanning[64];
        */
        defaultSpeed : 6,
        defaultBPM : 125,

        // Specifics
        freqType : '',
        noteType : '',

        orderTable : []
    },
    instruments : [],
    samples : [],
    patterns : []
};
