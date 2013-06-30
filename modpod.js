/*
Copyright (c) 2013, Douglas Gore
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met: 

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer. 
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution. 

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/*
 MODpod - A JavaScript based multi-format module player using WebAudio

 TODO:
 - WHERE IS FINETUNE?!?!??!
 
 - When changing the sample rate of a channel we should be updating the sample step increment,
   this does not always appear to be the case. This may make effects like vibrato do nothing.
   
 - S3M is clipping, this is probably due to volume being treated as as 0-63 range when it may
   be 0-127 or 0-255. I believe this is causing the audio levels to be scaled above the -1 to
   1 range causing hard clipping. We need to normalise volumes parameters across all module
   formats to get consistent results.
   
 - Reintroduce and correct panning support
 
 - Is arppegio implemented correctly?
 
 - Still some issues with note sliding, see Chicago song
 
 - Ode to Protracker crashes
 
 - Backwards crashes
 
 - 64 Mania (S3M) doesn't play correctly

 - Reintroduce XM support
 
 - Cyberride has some odd audio glitches in sample playback
 
 - Point of Departure (S3M) sounds odd
 
 - Missing MOD effects
 
 - Missing S3M effects
 
 - Missing XM effects
 
 - S3M support has incomplete volume handling and global properties
 
 - Rewrite mixing logic, wrriten to be linear not logarithmic
 
 - No ability to stop playback at the end of a song
 
 - Time position does not take into account loops
 
 - Rename sample rate to frequency for correctness
 
 - Split code into more functions and modules
 
 - Loader support should be done via registering callbacks
 
 - Should effect handling be global or local to loader?
 
 - Formalise an official API and deployment package
*/

/*global document: false, webkitAudioContext: false, AudioContext: false,  imfData: false, console: false */

var context;

var imfData;

var mpLoaderTable;

// Create our audio context, assume it's standardised, before trying vendor extension
if (typeof AudioContext === "function")
{
    context = new window.AudioContext();
}
else if (typeof webkitAudioContext === "function")
{
    context = new window.webkitAudioContext();
}
else
{
    throw new Error('AudioContext not supported. :-(');
}

// A 11 octave period table, this is used for look ups
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

/* Triton's linear periods to frequency translation table (for XM modules) */
var lintab = [
    535232,534749,534266,533784,533303,532822,532341,531861,
    531381,530902,530423,529944,529466,528988,528511,528034,
    527558,527082,526607,526131,525657,525183,524709,524236,
    523763,523290,522818,522346,521875,521404,520934,520464,
    519994,519525,519057,518588,518121,517653,517186,516720,
    516253,515788,515322,514858,514393,513929,513465,513002,
    512539,512077,511615,511154,510692,510232,509771,509312,
    508852,508393,507934,507476,507018,506561,506104,505647,
    505191,504735,504280,503825,503371,502917,502463,502010,
    501557,501104,500652,500201,499749,499298,498848,498398,
    497948,497499,497050,496602,496154,495706,495259,494812,
    494366,493920,493474,493029,492585,492140,491696,491253,
    490809,490367,489924,489482,489041,488600,488159,487718,
    487278,486839,486400,485961,485522,485084,484647,484210,
    483773,483336,482900,482465,482029,481595,481160,480726,
    480292,479859,479426,478994,478562,478130,477699,477268,
    476837,476407,475977,475548,475119,474690,474262,473834,
    473407,472979,472553,472126,471701,471275,470850,470425,
    470001,469577,469153,468730,468307,467884,467462,467041,
    466619,466198,465778,465358,464938,464518,464099,463681,
    463262,462844,462427,462010,461593,461177,460760,460345,
    459930,459515,459100,458686,458272,457859,457446,457033,
    456621,456209,455797,455386,454975,454565,454155,453745,
    453336,452927,452518,452110,451702,451294,450887,450481,
    450074,449668,449262,448857,448452,448048,447644,447240,
    446836,446433,446030,445628,445226,444824,444423,444022,
    443622,443221,442821,442422,442023,441624,441226,440828,
    440430,440033,439636,439239,438843,438447,438051,437656,
    437261,436867,436473,436079,435686,435293,434900,434508,
    434116,433724,433333,432942,432551,432161,431771,431382,
    430992,430604,430215,429827,429439,429052,428665,428278,
    427892,427506,427120,426735,426350,425965,425581,425197,
    424813,424430,424047,423665,423283,422901,422519,422138,
    421757,421377,420997,420617,420237,419858,419479,419101,
    418723,418345,417968,417591,417214,416838,416462,416086,
    415711,415336,414961,414586,414212,413839,413465,413092,
    412720,412347,411975,411604,411232,410862,410491,410121,
    409751,409381,409012,408643,408274,407906,407538,407170,
    406803,406436,406069,405703,405337,404971,404606,404241,
    403876,403512,403148,402784,402421,402058,401695,401333,
    400970,400609,400247,399886,399525,399165,398805,398445,
    398086,397727,397368,397009,396651,396293,395936,395579,
    395222,394865,394509,394153,393798,393442,393087,392733,
    392378,392024,391671,391317,390964,390612,390259,389907,
    389556,389204,388853,388502,388152,387802,387452,387102,
    386753,386404,386056,385707,385359,385012,384664,384317,
    383971,383624,383278,382932,382587,382242,381897,381552,
    381208,380864,380521,380177,379834,379492,379149,378807,
    378466,378124,377783,377442,377102,376762,376422,376082,
    375743,375404,375065,374727,374389,374051,373714,373377,
    373040,372703,372367,372031,371695,371360,371025,370690,
    370356,370022,369688,369355,369021,368688,368356,368023,
    367691,367360,367028,366697,366366,366036,365706,365376,
    365046,364717,364388,364059,363731,363403,363075,362747,
    362420,362093,361766,361440,361114,360788,360463,360137,
    359813,359488,359164,358840,358516,358193,357869,357547,
    357224,356902,356580,356258,355937,355616,355295,354974,
    354654,354334,354014,353695,353376,353057,352739,352420,
    352103,351785,351468,351150,350834,350517,350201,349885,
    349569,349254,348939,348624,348310,347995,347682,347368,
    347055,346741,346429,346116,345804,345492,345180,344869,
    344558,344247,343936,343626,343316,343006,342697,342388,
    342079,341770,341462,341154,340846,340539,340231,339924,
    339618,339311,339005,338700,338394,338089,337784,337479,
    337175,336870,336566,336263,335959,335656,335354,335051,
    334749,334447,334145,333844,333542,333242,332941,332641,
    332341,332041,331741,331442,331143,330844,330546,330247,
    329950,329652,329355,329057,328761,328464,328168,327872,
    327576,327280,326985,326690,326395,326101,325807,325513,
    325219,324926,324633,324340,324047,323755,323463,323171,
    322879,322588,322297,322006,321716,321426,321136,320846,
    320557,320267,319978,319690,319401,319113,318825,318538,
    318250,317963,317676,317390,317103,316817,316532,316246,
    315961,315676,315391,315106,314822,314538,314254,313971,
    313688,313405,313122,312839,312557,312275,311994,311712,
    311431,311150,310869,310589,310309,310029,309749,309470,
    309190,308911,308633,308354,308076,307798,307521,307243,
    306966,306689,306412,306136,305860,305584,305308,305033,
    304758,304483,304208,303934,303659,303385,303112,302838,
    302565,302292,302019,301747,301475,301203,300931,300660,
    300388,300117,299847,299576,299306,299036,298766,298497,
    298227,297958,297689,297421,297153,296884,296617,296349,
    296082,295815,295548,295281,295015,294749,294483,294217,
    293952,293686,293421,293157,292892,292628,292364,292100,
    291837,291574,291311,291048,290785,290523,290261,289999,
    289737,289476,289215,288954,288693,288433,288173,287913,
    287653,287393,287134,286875,286616,286358,286099,285841,
    285583,285326,285068,284811,284554,284298,284041,283785,
    283529,283273,283017,282762,282507,282252,281998,281743,
    281489,281235,280981,280728,280475,280222,279969,279716,
    279464,279212,278960,278708,278457,278206,277955,277704,
    277453,277203,276953,276703,276453,276204,275955,275706,
    275457,275209,274960,274712,274465,274217,273970,273722,
    273476,273229,272982,272736,272490,272244,271999,271753,
    271508,271263,271018,270774,270530,270286,270042,269798,
    269555,269312,269069,268826,268583,268341,268099,267857
];

// A sine lookup table used by the vibrato effect
var sineTable = [   0, 24, 49, 74, 97,120,141,161,
                  180,197,212,224,235,244,250,253,
                  255,253,250,244,235,224,212,197,
                  180,161,141,120, 97, 74, 49, 24 ];

var effects =
{
    // Protracker effects
    PT_EFFECT0 : 0x0,		// Arpeggio
    PT_EFFECT1 : 0x1,		// Porta up
    PT_EFFECT2 : 0x2,		// Porta down
    PT_EFFECT3 : 0x3,		// Porta to note
    PT_EFFECT4 : 0x4,		// Vibrato
    PT_EFFECT5 : 0x5,		// Dual effect 3 + A
    PT_EFFECT6 : 0x6,		// Dual effect 4 + A
    PT_EFFECT7 : 0x7,		// Tremolo
    PT_EFFECT8 : 0x8,		// Pan
    PT_EFFECT9 : 0x9,		// Sample offset
    PT_EFFECTA : 0xA,		// Volume slide
    PT_EFFECTB : 0xB,		// Pattern jump
    PT_EFFECTC : 0xC,		// Set volume
    PT_EFFECTD : 0xD,		// Pattern break
    PT_EFFECTE : 0xE,		// Extended MOD effects
    PT_EFFECTF : 0xF,		// Set speed
    // Scream Tracker effects
    S3M_EFFECTA : 0x10,	// Set speed
    S3M_EFFECTD : 0x11,	// Volume slide
    S3M_EFFECTE : 0x12,	// Porta down
    S3M_EFFECTF : 0x13,	// Porta up
    S3M_EFFECTI : 0x14,	// Tremor
    S3M_EFFECTQ : 0x15,	// Retrig
    // IMF effects
    IMF_EFFECTFF : 0xFF	// No effect
};

// Enums for defining playback mode
var freqTable = { AMIGA : 0, LINEAR : 1 };
var audSource = { SAMPLES : 0, INSTRUMENTS : 1 };

// Convert finetune value to Hz frequency
function FinetoHz(ft)
{
    switch(ft)
    {
    case  0 : return 8363;
    case  1 : return 8413;
    case  2 : return 8463;
    case  3 : return 8529;
    case  4 : return 8581;
    case  5 : return 8651;
    case  6 : return 8723;
    case  7 : return 8757;
    case  8 : return 7895;
    case  9 : return 7941;
    case 10 : return 7985;
    case 11 : return 8046;
    case 12 : return 8107;
    case 13 : return 8169;
    case 14 : return 8232;
    case 15 : return 8280;
    default : return 8363;
    }
}

// Declare our modpod "class" and it's "private" variables
function modpod()
{
    this.modLocation = "";
    
    // Output stream information
    this.outputSampleRate = 0;

    this.bPlayerInit = false;

    this.bRowComplete = false;
    this.bAudioComplete = false;
    this.bGenerateAudio = 0;

    this.speed = 0;
    this.BPM = 0;
    this.tickCount = 0;

    this.workNote = null;

    // Song position information
    this.workPattern = 0;
    this.workRow = 0;

    // Song control variables
    this.patternDelay = 0;
    this.handledBreak = false;
    this.stopSong = false;

    // Effect parameters
    this.EParamX = 0;
    this.EParamY = 0;
    
    this.samplesLeft = 0;

    this.audioNode = null;
    
    this.playTime = 0;
    
    this.channels = [];
    
    // Callbacks for sending interesting events back to JS clients
    this.callbacks =
    {
        newOrder : null,
        updatePlayTime : null,
        newRow : null
    };
}

modpod.prototype.note2Period = function (note, fineTune)
{
    if(imfData.header.freqType === freqTable.AMIGA)
    {
        return periodTable[note];
    }
    else
    {
        // Linear - Period = 10*12*16*4 - Note*16*4 - FineTune / 2
        
        return 7680 - note * 64 - fineTune / 2;
    }
};

modpod.prototype.setFrequencyFromPeriod = function(channel)
{
    //Channels[c].SampleRate = 14317056L / (8363 * Channels[c].Period / Song.Samples[Channels[c].Sample-1].SampleRate);
    
    if(imfData.header.freqType === freqTable.AMIGA)
    {
        // Sanity check to see if we have a valid sample reference
        if (this.channels[channel].sample === 0)
        {
            return;
        }
        
        // MOD calc
        this.channels[channel].sampleRate = (8363 * 1712) / (8363 * this.channels[channel].period / imfData.samples[this.channels[channel].sample - 1].sampleRate);
        
        // S3M calc
        //var st3period = 8363 * 16  * (
        //this.channels[channel].sampleRate = 
    }
    else
    {
        //Channels[c].SampleRate = 8363*2^((6*12*16*4 - Channels[c].Period) / (12*16*4));
        //Channels[c].SampleRate = (float)(8363 * pow(2, (4608 - Channels[c].Period) / 768));
        this.channels[channel].sampleRate = lintab[this.channels[channel].period % 768] >> (this.channels[channel].period / 768);
    }
    
    // Section to work out stepping (JS note: OR'd by 0 to truncate)
    this.channels[channel].sampleStep = (this.channels[channel].sampleRate / this.outputSampleRate);
};
    
modpod.prototype.setFrequency = function (channel, freq)
{
    this.channels[channel].sampleRate = freq;

    // Section to work out stepping (JS note: OR'd by 0 to truncate)
    this.channels[channel].sampleStep = (this.channels[channel].sampleRate / this.outputSampleRate);
};

modpod.prototype.playerInit = function()
{
    this.patternDelay = 0;
    
    this.stopSong = false;

    // Make sure everything is set to zero
    this.tickCount = 0;
    this.workPattern = 0;
    this.workRow = 0;

    // Set up the default speed and tempo
    this.speed = imfData.header.defaultSpeed;
    this.BPM = imfData.header.defaultBPM * 2 / 5;
    
    this.bPlayerInit = true;
};
    
modpod.prototype.handleLoad = function(modLocation, modArray)
{
    var ii;

    this.modLocation = modLocation;

    var extStart = this.modLocation.lastIndexOf(".");
    var fileExt = this.modLocation.slice(extStart + 1).toUpperCase();

    console.log("Parsing original data and converting to IMF...\n");
    console.log("Loading file '%s'\n", this.modLocation);

    // TODO: Replace the code below with a dynamic loader system
    if (fileExt === "MOD") { loadMod(modArray, imfData); }
    if (fileExt === "S3M") { loadS3M(modArray, imfData); }
    if (fileExt === "XM") { loadXM(modArray, imfData); }
    
    if(!imfData.header)
    {
        return false;
    }

    this.bPlayerInit = false;
    this.playerInit();

    this.createChannels();
  
    console.log("Output sample rate: "+ context.sampleRate);
    
    if (this.callbacks.newOrder)
    {
        this.callbacks.newOrder(this.workPattern, imfData.header.numPositions);
    }

    this.audioNode = context.createScriptProcessor(16384, 0, 2);
    this.audioNode.onaudioprocess = audioGenerator;
    this.audioNode.connect(context.destination);
};

modpod.prototype.stop = function()
{
    this.audioNode.disconnect(context.destination);
    imfData = undefined;
    //delete imfData;
}

modpod.prototype.createChannels = function()
{
    var ii;

    for (ii = 0; ii < imfData.header.numChannels; ii++)
    {
        this.channels[ii] =
        {
            instrument  : 0,
            sample      : 0,
            trigger     : false,
            volume      : 0,
            note        : 0,
            origNote    : 0,
            finetune    : 0,
            period      : 0,
            panning     : 0,
            
            portaNote   : 0,
            portaSpeed  : 0,

            delayNote   : 0,
            
            vibPos      : 0,
            vibSpeed    : 0,
            vibDepth    : 0,

            portaParam  : 0,

            effect      : 0,
            effectData  : 0,
            lastEffectData : 0,

            sampleRate  : 0,

            samplePosition  : 0,
            sampleStep      : 0,

            // INSTRUMENT RELATED
            // Insert here please
            playTick        : 0,
            volEnvX         : 0,
            
            sptr            : null,
            VolY            : 0
        };
    }
};

// 16384 bytes
// 48000 KHz/s sample rate
// 44100 / 16384 = 0.34133333333333333333333333333333 second of audio per buffer

// 50Hz = 50 ticks per second (0.02s per tick)
// speed = ticks per row

// samplesPerTick = 0.37 / 0.02

modpod.prototype.generateAudio = function(evt)
{
    this.outputSampleRate = evt.outputBuffer.sampleRate;
    var leftAudioBuffer = evt.outputBuffer.getChannelData(0);
    var rightAudioBuffer = evt.outputBuffer.getChannelData(1);
    var outputOffset = 0;
    
    var outputDataLength = leftAudioBuffer.length;
    
    // How many output samples we can generate before the next tick
    //var samplesPerTick = this.outputSampleRate * (1 / 50);
    var samplesPerTick = this.outputSampleRate * (1 / this.BPM);
    
    var mixValue;
    var leftMix;
    var rightMix;
    
    var c;

    // Loop while we haven't filled an output buffer
    while(outputDataLength)
    {
        //console.log("Loop outputDataLength = " + outputDataLength);
        
        // If we have generated all the sample data we require for a tick
        // then we can advance one tick forwards
        if (this.samplesLeft <= 0)
        {
            // Check to see if song has finished
            if (this.workPattern === imfData.header.numPositions)
            {
                //console.log("Reached the end of the song");
                //return 0;
                this.workPattern = 0;
            }

            // Process channel information
            if (this.tickCount === 0)
            {
                // Go off and process where we are in the current pattern
                this.processPattern();
            }
            else
            {
                this.tickEffect();
            }

            this.tickCount++;
            
            this.playTime += 20;
            
            if (this.callbacks.updatePlayTime)
            {
                this.callbacks.updatePlayTime(this.playTime);
            }
                
            // FIXME for XM
            // this.channels[c].playTick++;

            if (this.patternDelay > 0)
            {
                this.patternDelay--;
            }
            // Have we reached the ticks per row value?
            else if (this.tickCount >= this.speed)
            {
                // Reset the tick counter to zero
                this.tickCount = 0;

                if(this.stopSong === true)
                {
                    return;
                }

                //if (this.patternDelay === 0)
                //{
                    this.workRow++;
                //    console.log("Dly 0, inc row from " + this.workRow);
                //}

                // If we've reached the end of this track's row...
                if (this.workRow === imfData.patterns[imfData.header.orderTable[this.workPattern]].columns[0].channelHeight)
                {
                    // Increment the pattern we're on
                    this.workPattern++;
                    
                    if (imfData.header.orderTable[this.workPattern] === 255)
                    {
                        return 0;
                    }
                    
                    // Reset the processing row to zero
                    this.workRow = 0;
                    
                    if (this.callbacks.newOrder)
                    {
                        this.callbacks.newOrder(this.workPattern, imfData.header.numPositions);
                    }
                }

                if (this.callbacks.newRow)
                {
                    this.callbacks.newRow(this.workRow);
                }
            }

//----------------------------------------------------------------------
            // Process channel information
            for (c = 0; c < imfData.header.numChannels; c++)
            {
                if(this.channels[c].instrument > 0)
                {
                    var VolY;

                    if(imfData.header.noteType === audSource.INSTRUMENTS)
                    {
                        if(imfData.instruments[this.channels[c].instrument-1].volEnvOn === true)
                        {
                            if(imfData.instruments[this.channels[c].instrument-1].volumeEnv[this.channels[c].volEnvX+2] === this.channels[c].playTick)
                            {
                                this.channels[c].VolEnvX += 2;
                            }
                            
                            VolY = imfData.instruments[this.channels[c].instrument-1].volumeEnv[this.channels[c].volEnvX + 1];
                        }
                        else
                        {
                            VolY = 1.0;
                        }
                    }
                    else
                    {
                        VolY = 1.0;
                    }

                    /*
                    // Work out the channel panning
                    if(this.channels[c].panning < 0)
                    {
                        //LeftMix = abs(Channels[c].Panning);
                        //RightMix = 128 - abs(Channels[c].Panning);
                        leftMix = (abs(this.channels[c].panning) / 2) + 64;
                        rightMix = 64 + (this.channels[c].panning / 2);
                    }
                    else
                    {
                        //LeftMix = 127 - Channels[c].Panning;
                        //RightMix = Channels[c].Panning;
                        leftMix = 64 - (this.channels[c].panning / 2);
                        rightMix = (this.channels[c].panning / 2) + 64;
                    }
                    */
                    
                    // JS temp Disabled panning until new routine can be worked out
                    leftMix = 1.0;
                    rightMix = 1.0;
                    
                    this.channels[c].VolY = VolY;
                }					
                
            } // End of channel processing
            
            this.samplesLeft = samplesPerTick;
        }

        // Ensure the buffer is zeroed
        leftAudioBuffer[outputOffset] = 0;
        rightAudioBuffer[outputOffset] = 0;
        
        // Process channel information
        for (c = 0; c < imfData.header.numChannels; c++)
        {
            if ((this.channels[c].instrument > 0) && (imfData.samples[this.channels[c].sample - 1].sampleLength > 2))
            {
                // Check to see if loop point has been meet
                if( (imfData.samples[this.channels[c].sample - 1].loopMode > 0) &&
                    ( (this.channels[c].samplePosition | 0) >= imfData.samples[this.channels[c].sample - 1].loopEnd) )
                {
                    this.channels[c].samplePosition = imfData.samples[this.channels[c].sample - 1].loopStart;
                }
                
                // Break out if we've reached the end of the sample
                if((this.channels[c].samplePosition | 0) >= imfData.samples[this.channels[c].sample - 1].sampleLength)
                {
                    continue;
                }
                
                /* Disabled as using FP mixing now for JS
                if(imfData.samples[this.channels[c].sample - 1].bits == 16)
                {
                    //MixValue = float(wptr[Channels[c].IntPosition]>>8 * Channels[c].Volume);  // >> 6 / 128
                    mixValue = float(wptr[this.channels[c].intPosition] >> 8 * this.channels[c].volume);  // >> 6 / 128
                }
                else
                {
                    //MixValue = float(bptr[this.channels[c].intPosition] * this.channels[c].volume * 4);  // >> 6 / 128
                    mixValue = bptr[this.channels[c].intPosition] * this.channels[c].volume * 4;  // >> 6 / 128
                }
                */
                
                // Take sample data point (-1.0 to 1.0)
                mixValue = this.channels[c].sptr[this.channels[c].samplePosition | 0];
                
                // Scale it by channel volume
                mixValue *= (this.channels[c].volume / 64);
                
                //MixValue = float(*(Song.Samples[Channels[c].Instrument-1].Data + Channels[c].IntPosition) * Channels[c].Volume);  // >> 6 / 128
                //MixValue = float(*(Song.Samples[Channels[c].Instrument-1].Data + Channels[c].IntPosition) * Channels[c].Volume) / 256;

                leftAudioBuffer[outputOffset] += mixValue; //(mixValue * leftMix) * VolY;
                rightAudioBuffer[outputOffset] += mixValue; //(mixValue * rightMix) * VolY;
                
                // Increment our steps
                this.channels[c].samplePosition += this.channels[c].sampleStep;
            }

        }	// End process channel loop
        
        // In theory for 8-bit mixing (/ panning / volume)
        //mixit = ((MixBuffer[i]>>6>>7) / Song.Header->NumChannels);
        
        leftAudioBuffer[outputOffset] = leftAudioBuffer[outputOffset] / imfData.header.numChannels;
        rightAudioBuffer[outputOffset] = rightAudioBuffer[outputOffset] / imfData.header.numChannels;

        // Ensure that our data falls within the expected ranges
        if(leftAudioBuffer[outputOffset] < -1.0)
        {
            console.log("CLIPPING: Too low");
            leftAudioBuffer[outputOffset] = -1.0;
        }
        else if (leftAudioBuffer[outputOffset] > 1.0)
        {
            console.log("CLIPPING: Too high");
            leftAudioBuffer[outputOffset] = 1.0;
        }

        // Ensure that our data falls within the expected ranges
        if(rightAudioBuffer[outputOffset] < -1.0)
        {
            //printf("CLIPPING: Too low\n");
            rightAudioBuffer[outputOffset] = -1.0;
        }
        else if (rightAudioBuffer[outputOffset] > 1.0)
        {
            //printf("CLIPPING: Too high\n");
            rightAudioBuffer[outputOffset] = 1.0;
        }

        outputOffset++;
        outputDataLength--;
        
        this.samplesLeft--;
    }
};

modpod.prototype.processPattern = function()
{
    var c;
    
    // If no pattern delay is set or it has expired then continue
    if(this.patternDelay === 0)
    {
        this.handledBreak = false;
        
        // Process row
        for (c = 0; c < imfData.header.numChannels; c++)
        {
            // Grab our current working note
            this.workNote = imfData.patterns[imfData.header.orderTable[this.workPattern]].columns[c].data[this.workRow];
            
            /* ORDER OF WORKING NOTE PROCESSING (changed due to XM support)
                1 - Set effects (no dependance)
                2 - Set volume (no dependance)
            */
            
            // Is their a note trigger? (255 is no note)
            if(this.workNote.note < 254)
            {
            
                // Check to see if this is a porta note (Effect 0x3)
                if(this.workNote.effect === effects.PT_EFFECT3)
                {
                    //Channels[c].PortaNote = WorkNote.Note - 1;
                    this.channels[c].portaNote = this.note2Period(this.workNote.note - 1, 0);
                    //console.log(c + "," + this.workRow +") Porta note " + this.channels[c].portaNote + " : Original note: " + this.channels[c].period);
                }
                // Check to see if this is a delay note (Effect 0xE sub-effect 0xD)
                else if( ( (this.workNote.effect === effects.PT_EFFECTE) && ((this.channels[c].effectData >> 4) === 13) ) )
                {
                    this.channels[c].delayNote = this.note2Period(this.workNote.note - 1, 0);
                }
                // Otherwise we assume it's an ordinary note
                else
                {
                    this.channels[c].note = this.workNote.note - 1;
                    //Channels[c].OrigNote = Note2Period(Channels[c].Note, Channels[c].Finetune);
    
                    // TMP DISABLE - Channels[c].Period = Note2Period(Channels[c].Note, Channels[c].Finetune); //PeriodTable[Channels[c].Note];
                    this.channels[c].trigger = true;

                    this.channels[c].samplePosition = 0;
                }
    
            }
            // This note is a keyoff
            else if (this.workNote.note === 254)
            {
                this.channels[c].instrument = 0;
            }
    
            if (this.workNote.instrument > 0)
            {
                if(imfData.header.noteType === audSource.INSTRUMENTS)
                {
                    //Channels[c].Instrument = Song.Instruments[WorkNote.Instrument].NoteMap[WorkNote.Note];
                    this.channels[c].instrument = this.workNote.instrument;
                    this.Channels[c].sample = this.instruments[this.workNote.instrument - 1].noteMap[this.channels[c].note] + 1;
                }
                else
                {
                    this.channels[c].instrument = this.workNote.instrument;
                    this.channels[c].sample = this.workNote.instrument;
                }

                this.channels[c].volume = imfData.samples[this.channels[c].sample - 1].volume; // WorkNote.Instrument-1
                this.channels[c].finetune = imfData.samples[this.channels[c].sample - 1].finetune;
    
                // Sets the current sample rate needed for playback
                //SetFrequency();

                this.channels[c].vibPos = 0;
            }
    
            // Set the volume for the channel if specified
            if (this.workNote.volume !== 255)
            {
                this.channels[c].volume = this.workNote.volume;
            }

            // Set the note's effect information to the channel (as other notes may use it)
            this.channels[c].effect = this.workNote.effect;
            this.channels[c].effectData = this.workNote.effectData;
            
            if (this.channels[c].effectData != 0x00)
            {
                this.channels[c].lastEffectData = this.channels[c].effectData;
            }

            // NEW XM RELATED STUFF
            //if((this.workNote.instrument > 0) && (this.channels[c].trigger === true))
            if(this.channels[c].trigger === true)
            {
                this.channels[c].note += imfData.samples[this.channels[c].sample - 1].relativeNote;
                this.channels[c].period = this.note2Period(this.channels[c].note, this.channels[c].finetune);
                this.channels[c].playTick = 0;
                this.channels[c].volEnvX = 0;

                // Sets the current sample rate needed for playback
                this.setFrequencyFromPeriod(c);

                this.channels[c].sptr = imfData.samples[this.channels[c].sample - 1].data;
                
                this.channels[c].trigger = false;
            }

                    
        }	// End process row loop
        
        // Process channel information
        for(c = 0; c < imfData.header.numChannels; c++)
        {
            // Process any effects on this row
            this.rowEffect(c);
                
        }	// End process channel loop

    }	// End pattern delay check
};

modpod.prototype.rowEffect = function(c)
{
    // Set effect parameters
    this.EParamX = this.channels[c].effectData >> 4;
    this.EParamY = this.channels[c].effectData & 0xF;
        
    // Retrigger any vibrato effects
    this.channels[c].vibPos = 0;
            
    switch (this.channels[c].effect)
    {
    case effects.PT_EFFECT0: break; // We've already dealt with this is
    case effects.PT_EFFECT1: break; // We've already dealt with this is
    case effects.PT_EFFECT2: break; // We've already dealt with this is
    
    case effects.PT_EFFECT3:        // 0x3 - Porta to note
        {
            if(this.channels[c].effectData)
            {
                this.channels[c].portaSpeed = this.channels[c].effectData;
            }
        } break;
    
    case effects.PT_EFFECT4:        // 0x4 - Vibrato
        {
            if (this.EParamX)
            {
                this.channels[c].vibSpeed = this.EParamX;
            }
            
            if (this.EParamY)
            {
                this.channels[c].vibDepth = this.EParamY;
            }
        } break;
    
    case effects.PT_EFFECT5: break;
    case effects.PT_EFFECT6: break;
    case effects.PT_EFFECT8: break;
                
    case effects.PT_EFFECT9:        // 0x9 - Set sample offset
        {
            //Channels[c].VPosition = (float)(Channels[c].effectData * 0x100);
            //this.channels[c].IntPosition = this.channels[c].effectData * 0x100;
            this.channels[c].samplePosition = this.channels[c].effectData * 0x100;
        } break;
                
    case effects.PT_EFFECTA: break; // We've already dealt with this is
    
    case effects.PT_EFFECTB:	// 0xB - Position Jump
        {
            console.log("Need to fix position jump (jump to pattern: " + this.channels[c].effectData + ")");
            this.workRow = 0;
            this.workPattern = this.channels[c].effectData;
            //this.resetRow = true;
        } break;
    
    case effects.PT_EFFECTC:	// 0xC - Set volume
        {
            this.channels[c].volume = this.channels[c].effectData;
        } break;
        
    case effects.PT_EFFECTD:	// 0xD - Pattern Break
        {
            // Increment on to the next pattern
            if (!this.handledBreak)
            {
                this.workPattern++;
                this.handledBreak = true;
            }
            else
            {
                console.log("Pattern break already seen!");
            }

            if (this.workPattern === imfData.header.numPositions)
            {
                this.stopSong = true;
            }
            else
            {
                this.workRow = (this.EParamX * 10) + this.EParamY;
                this.workRow--;
                console.log("Jumping to row " + this.workRow);
                //this.resetRow = true; 
            }

            // Blanks any invalid values
            if(this.workRow > 63)
            {
                this.workRow = 63;
            }
    
        } break;
                    
    case effects.PT_EFFECTE:	// 0xE - Extended MOD command
        {
            switch(this.EParamX)
            {
            case 0: break; // Amiga hardware effect, ignore
            
            case 0x8:	// 0xE8 - Set Pan Position
                {
                    this.channels[c].panning = (this.EParamY - 0x8) * 8;
                } break;
    
            case 0xA:	// 0xEA - Fine volume slide down
                {
                    this.channels[c].volume += this.EParamY;
                } break;

            case 0xB:	// 0xEB - Fine volume slide down
                {
                    this.channels[c].volume -= this.EParamY;
                } break;

            case 0xD: break;	// 0xED - Note delay (dealt with below)
                    
            case 0xE:	// 0xEE - Pattern delay
                {
                    this.patternDelay = this.EParamY;
                } break;
                
            default:
                {
                    console.log("Unsupported effect 14 command variation %i.\n", this.EParamX);
                } break;
            }
        } break;
                    
    case effects.PT_EFFECTF:	// 0xF - Set Speed/Tempo
        {
            if (this.channels[c].effectData <= 32)
            {
                this.speed = this.channels[c].effectData;
            }
            else
            {
                this.BPM = this.channels[c].effectData * 2 / 5;
                console.log("Speed change to " + this.BPM + " BPM");
            }
        } break;
    
    case effects.S3M_EFFECTA: this.speed = this.channels[c].effectData; break;	// S3M Set Speed
    case effects.S3M_EFFECTD: this.doS3MVolSlide(c); break;	// S3M Volume slide
    case effects.S3M_EFFECTE: this.doS3MPortaDown(c); break;	// S3M Portamento down
    case effects.S3M_EFFECTF: this.doS3MPortaUp(c); break;		// S3M Portamento up
    case effects.S3M_EFFECTQ: break;						// S3M Retrig + Volume slide
    case effects.IMF_EFFECTFF: break;	// 0xFF - No effect marker

    default:
        {
            //console.log("Unsupported Protracker effect #%i, data %i\n", this.channels[c].effect, this.channels[c].effectData);
        } break;
    }
};
    
modpod.prototype.tickEffect = function()
{
    var c;
    
    for (c = 0; c <  imfData.header.numChannels; c++)
    {
        // Set effect parameters
        this.EParamX = this.channels[c].effectData >> 4;
        this.EParamY = this.channels[c].effectData & 0xF;

        switch (this.channels[c].effect)
        {
        case effects.PT_EFFECT0:
            {
                // Abort this effect if there is no valid sample to apply it to
                if (this.channels[c].sample === 0)
                {
                    break;
                }
                
                /* XM NOTE - Disabled until periodtable and sample rate can be resolved! */
                if(this.channels[c].effectData > 0)
                {
                    switch(this.tickCount % 3)
                    {
                    case 0: break;
                    case 1:
                        {
                            this.setFrequency(c, 14317056 / (8363 * periodTable[this.channels[c].note + this.EParamX] / imfData.samples[this.channels[c].sample - 1].sampleRate));
                        } break;

                    case 2:
                        {
                            this.setFrequency(c, 14317056 / (8363 * periodTable[this.channels[c].note + this.EParamY] / imfData.samples[this.channels[c].sample - 1].sampleRate));
                        } break;
                    }
                }
            } break;
        
        case effects.PT_EFFECT1:	// 0x1 - Porta up
            {
                this.channels[c].period -= this.channels[c].effectData;
                
                // Not allowed to slide beyond B3
                if (this.channels[c].period < 453)
                {
                    console.log("Changing period to 453");
                    this.channels[c].period = 453;
                }
                
                this.setFrequencyFromPeriod(c);
            } break;
            
        case effects.PT_EFFECT2:	// 0x2 - Porta down
            {
                this.channels[c].period += this.channels[c].effectData;

                // Not allowed to slide beyond C1
                if (this.channels[c].period > 3424)
                {
                    console.log("Changing period to 3424");
                    this.channels[c].period = 3424;
                }

                this.setFrequencyFromPeriod(c);
            } break;
            
        case effects.PT_EFFECT3: this.doPorta(c); break;		// 0x3 - Slide to Note
        case effects.PT_EFFECT4: this.doVibrato(c); break;	// 0x4 - Vibrato
        case effects.PT_EFFECT5: this.doPorta(c); this.doVolSlide(c); break;
        case effects.PT_EFFECT6: this.doVibrato(c); this.doVolSlide(c); break;
        case effects.PT_EFFECTA: this.doVolSlide(c); break;

        case effects.PT_EFFECTE:
            {
                switch(this.EParamX)
                {
                case 13:
                    {
                        if (this.tickCount === this.EParamY)
                        {
                            this.channels[c].period = this.channels[c].delayNote;
                        }
                    }
                }
            } break;

        case effects.S3M_EFFECTD: this.doS3MVolSlide(c); break;	// S3M Volume slide
        case effects.S3M_EFFECTE: this.doS3MPortaDown(c); break;	// S3M Portamento down
        case effects.S3M_EFFECTF: this.doS3MPortaUp(c); break;		// S3M Portamento up

        case effects.S3M_EFFECTQ:
            {
                this.doS3MRetrig(c);

                if((this.tickCount % this.EParamY)==0)
                //Channels[c].VPosition = 0;
                this.channels[c].samplePosition = 0;
            } break;

        } // End of switch
    }

};

modpod.prototype.doPorta = function(c)
{
    // Slides the pitch down
    if(this.channels[c].period < this.channels[c].portaNote)
    {
        this.channels[c].period += (this.channels[c].portaSpeed << 2);
        
        if (this.channels[c].period > this.channels[c].portaNote)
        {
            this.channels[c].period = this.channels[c].portaNote;
        }
    }
    // Slides the pitch up
    else if(this.channels[c].period > this.channels[c].portaNote)
    {
        this.channels[c].period -= (this.channels[c].portaSpeed << 2);
        
        if (this.channels[c].period < this.channels[c].portaNote)
        {
            this.channels[c].period = this.channels[c].portaNote;
        }
    }
    
    this.setFrequencyFromPeriod(c);
};

modpod.prototype.doVibrato = function(c)
{
    var temp;
    var delta;

    temp = (this.channels[c].vibPos & 31);

    delta = sineTable[temp];

    delta *= this.channels[c].vibDepth;
    delta >>= 7;
    delta <<= 2;
    
    if(this.channels[c].vibPos >= 0)
    {
        this.setFrequency(c, 14317056 / ((8363 * this.channels[c].period / imfData.samples[this.channels[c].sample-1].sampleRate) + delta));
    }
    else
    {
        this.setFrequency(c, 14317056 / ((8363 * this.channels[c].period / imfData.samples[this.channels[c].sample-1].sampleRate) - delta));
    }

    this.channels[c].vibPos += this.channels[c].vibSpeed;

    if(this.channels[c].vibPos > 31)
    {
        this.channels[c].vibPos -= 64;
    }
};

modpod.prototype.doVolSlide = function(c)
{
    if (this.EParamY > 0)
    {
        if((this.channels[c].volume - this.EParamY) < 0)
        {
            this.channels[c].volume = 0;
        }
        else
        {
            this.channels[c].volume -= this.EParamY;
        }
    }

    if (this.EParamX > 0)
    {
        if((this.channels[c].volume + this.EParamX) > 64)
        {
            this.channels[c].volume = 64;
        }
        else
        {
            this.channels[c].volume += this.EParamX;
        }
    }
};

modpod.prototype.doS3MVolSlide = function(channel)
{
    var VParamX;
    var VParamY;

    if (this.channels[channel].effectData > 0)
    {
        VParamX = this.channels[channel].effectData >> 4;
        VParamY = this.channels[channel].effectData & 0xF;
    }
    else
    {
        VParamX = this.channels[channel].lastEffectData >> 4;
        VParamY = this.channels[channel].lastEffectData & 0xF;
    }

    //console.log("Do S3M vol slide, VParamX: "+ VParamX + ", VParamY: " + VParamY);

    // Not implemented
    // Dxy, 1 <= x <= 0xE, 1 <= y <= 0xE: Scream Tracker treats it as a slide down by y, i.e. equivalent to D0y. Impulse Tracker does nothing.

    // DFF: slide up by 15 on tick 0.
    if ((VParamX === 0xF) && (VParamY === 0xF))
    {
        if (this.tickCount === 0)
        {
            this.channels[channel].volume += 15;
        }
    }
    // D0F: slide down by 15 on all ticks. Not affected at all by the fast slides flag.
    else if ((VParamX === 0) && (VParamY === 0xF))
    {
        this.channels[channel].volume -= 15;
    }
    // DF0: slide up by 15 on all ticks. Not affected at all by the fast slides flag.
    else if ((VParamX === 0xF) && (VParamY === 0))
    {
        this.channels[channel].volume += 15;
    }
    // D0x, 1 <= x <= 0xE: slide down by x on all nonzero ticks. Also slide on tick 0, if fast slides are enabled.
    else if (VParamX === 0)
    {
        if ((this.tickCount !== 0) || (imfData.header.fastSlides === true))
        {
            this.channels[channel].volume -= VParamY;
        }
    }
    // Dx0, 1 <= x <= 0xE: slide up by x on all nonzero ticks. Also slide on tick 0, if fast slides are enabled.
    else if (VParamY === 0)
    {
        if ((this.tickCount !== 0) || (imfData.header.fastSlides === true))
        {
            this.channels[channel].volume += VParamX;
        }
    }
    // DFx, 1 <= x <= 0xE: slide down by x on tick 0.
    else if (VParamX === 0xF)
    {
        if (this.tickCount === 0)
        {
            this.channels[channel].volume -= VParamY;
        }
    }
    // DxF, 1 <= x <= 0xE: slide up by x on tick 0.
    else if (VParamY === 0xF)
    {
        if (this.tickCount === 0)
        {
            this.channels[channel].volume += VParamX;
        }
    }

    if (this.channels[channel].volume < 0)
    {
        this.channels[channel].volume = 0;
    }
    else if (this.channels[channel].volume > 64)
    {
        this.channels[channel].volume = 64;
    }
}

modpod.prototype.doS3MPortaDown = function(channel)
{
    var PParamX;
    var PParamY;

    if (this.channels[channel].effectData > 0)
    {
        this.channels[channel].portaParam = this.channels[channel].effectData;
    }

    PParamX = this.channels[channel].portaParam >> 4;
    PParamY = this.channels[channel].portaParam & 0xF;

    if(this.tickCount === 0)
    {
        if (PParamX == 0xF)
        {
            this.channels[channel].period += (PParamY << 2);
        }
        else if (PParamX==0xE)
        {
            this.channels[channel].period += PParamY;
        }
    }
    else
    {
        if (this.channels[channel].effectData < 0xE0)
        {
            this.channels[channel].period += this.channels[channel].effectData << 2;
        }
    }
}

modpod.prototype.doS3MPortaUp = function(channel)
{
    var PParamX;
    var PParamY;

    if (this.channels[channel].effectData > 0)
    {
        this.channels[channel].portaParam = this.channels[channel].effectData;
    }

    PParamX = this.channels[channel].portaParam >> 4;
    PParamY = this.channels[channel].portaParam & 0xF;

    if (this.tickCount === 0)
    {
        if (PParamX === 0xF)
        {
            this.channels[channel].period -= (PParamY << 2);
        }
        else if (PParamX === 0xE)
        {
            this.channels[channel].Period -= PParamY;
        }
    }
    else
    {
        if (this.channels[channel].effectData < 0xE0)
        {
            this.channels[channel].period -= this.channels[channel].effectData << 2;
        }
    }
}

modpod.prototype.doS3MRetrig = function(channel)
{
    switch(this.EParamX)
    {
    case 0x0: break;
    case 0x1: this.channels[channel].volume--; break;
    case 0x2: this.channels[channel].volume -= 2; break;
    case 0x3: this.channels[channel].volume -= 4; break;
    case 0x4: this.channels[channel].volume -= 8; break;
    case 0x5: this.channels[channel].volume -= 16; break;
    case 0x6: this.channels[channel].volume = (this.channels[channel].volume * 2) / 3; break;
    case 0x7: this.channels[channel].volume <<= 1;
    case 0x8: break;
    case 0x9: this.channels[channel].volume++; break;
    case 0xA: this.channels[channel].volume += 2; break;
    case 0xB: this.channels[channel].volume += 4; break;
    case 0xC: this.channels[channel].volume += 8; break;
    case 0xD: this.channels[channel].volume += 16; break;
    case 0xE: this.channels[channel].volume = (this.channels[channel].volume * 3) / 2; break;
    case 0xF: this.channels[channel].volume >>= 1;
    }
}

function audioGenerator(evt)
{
    mp.generateAudio(evt);
}
