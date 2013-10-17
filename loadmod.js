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
MOD Loader

Purpose: Logic to read and parse Amiga module music (MOD) and compatible
variants.
*/

// Module header structure
var MODHeader =
{
    songName        : '',
    numPositions    : 0,
    legacy          : 0,
    patternTable    : null,
    signature       : ''
};

function loadMod(modData, imfData)
{
    var numSamples;
    var numChannels = 0;
    var ii;
    var jj;
    var ss;

    var modSignatureBuf = modData.slice(1080, 1084);
    MODHeader.signature = String.fromCharCode.apply(null, new Uint8Array(modSignatureBuf));

    var viewData = new DataView(modData);
    var dataOffset = 0;

    // If any of these identifiers match, it is assumed there will be 31 instruments
    var channelNumTable =
    {
        'M.K.': 4,      // ProTracker (64 pattern)/NoiseTracker 4ch, 31 instruments (most common)
        'M!K!': 4,      // ProTracker (128 pattern) 4ch
        'CD81': 4,      // Octalyser
        'FLT4': 4,      // Star Tracker (StarTrekker) 4ch
        '4CHN': 4,
        '6CHN': 6,      // FastTracker 1.0
        '8CHN': 8,      // FastTracker 1.0
        'FLT8': 8       // Star Tracker (StarTrekker) 8ch (combines 2 patterns, will break)
        /*
        Many more MOD signatures are missing, they should be added as identified to a tracker
        */
    };

    // By default assume 31 sample MOD
    numSamples = 31;

    // Compare signature against all know module signatures
    numChannels = channelNumTable[MODHeader.signature];

    // If we didn't managed to match a signature then we assume
    // that this is a 15 sample MOD and therefore has 4 channels
    if (typeof numChannels === "undefined")
    {
        numChannels = 4;
        numSamples = 15;
    }
    
    imfData.header.numChannels = numChannels;
    imfData.header.numSamples = numSamples;
    imfData.header.defaultSpeed = 6;
    imfData.header.defaultBPM = 125;
    imfData.header.freqType = freqTable.AMIGA;
    imfData.header.noteType = audSource.SAMPLES;
    
    // This is to be used as an identifier for library client
    imfData.header.formatShort = "MOD";
    imfData.header.formatLong = "Amiga Protracker Module";

    imfData.header.songName = '';
    
    // Build the song name string
    for (ii = 0; ii < 20; ii++)
    {
        imfData.header.songName += String.fromCharCode(viewData.getInt8(dataOffset++));
    }

    for (ii = 0; ii < numSamples; ii++)
    {
        var sampleName = '';

        for (jj = 0; jj < 22; jj++)
        {
            sampleName += String.fromCharCode(viewData.getInt8(dataOffset++));
        }

        imfData.samples[ii] =
        {
            sampleName      : sampleName,
            sampleLength    : viewData.getUint16(dataOffset) * 2,
            finetune        : viewData.getUint8(dataOffset + 2),
            volume          : viewData.getInt8(dataOffset + 3),
            loopStart       : viewData.getUint16(dataOffset + 4) * 2,
            loopEnd         : (viewData.getUint16(dataOffset + 6) * 2),
            loopMode        : 0,
            panning         : 0,
            relativeNote    : 0,

            sampleRate      : FinetoHz(this.finetune & 0xF),
            bits            : 8,
            data            : null
        };
        
        // If the loop length is greater than 2 then we have a loop
        if (imfData.samples[ii].loopEnd > 2)
        {
            imfData.samples[ii].loopMode = 1;
        }
        
        // TEMP DEBUG
        if (imfData.samples[ii].finetune !== 0)
        {
            console.log("Sample " + ii + " has a non-zero finetune of " + imfData.samples[ii].finetune);
        }
        
        // Current value is actually loop length so convert to an end point
        imfData.samples[ii].loopEnd += imfData.samples[ii].loopStart;
        
        dataOffset += 8;
    }

    imfData.header.numPositions = viewData.getUint8(dataOffset++);
    
    // Skip a legacy byte
    dataOffset++;
    
    // Read the order table
    for (ii = 0; ii < 128; ii++)
    {
        imfData.header.orderTable[ii] = viewData.getUint8(dataOffset++);
        
        if (imfData.header.orderTable[ii] >= imfData.header.numPatterns)
        {
            imfData.header.numPatterns = imfData.header.orderTable[ii] + 1;
        }
    }
    
    // Skip the 4 byte signature as we already have it (does this break a 15 instrument MOD?)
    dataOffset += 4;

    // Create our pattern set
    
    var noteByte1,
        noteByte2,
        noteByte3,
        noteByte4;
    
    var playSample = 0,
        notePeriod = 0,
        noteEffect = 0,
        noteIndex = 0;

    // Read all patterns
    for (var pp = 0;  pp < imfData.header.numPatterns; pp++)
    {
        imfData.patterns[pp] = new Object();
        imfData.patterns[pp].columns = new Object();

        // Prepare the structures ready for writing
        for(jj = 0; jj < numChannels; jj++)
        {
            imfData.patterns[pp].columns[jj] =
            {
                channelHeight : 64,
                data : []
            };
        }

        // Now fill them with pattern data
        for (ii = 0; ii < 64; ii++)
        {
            // Loop around each channel
            for (jj = 0; jj < numChannels; jj++)
            {
                noteByte1 = viewData.getUint8(dataOffset++);
                noteByte2 = viewData.getUint8(dataOffset++);
                noteByte3 = viewData.getUint8(dataOffset++);
                noteByte4 = viewData.getUint8(dataOffset++);
                
                playSample = (noteByte1 & 0xF0) | (noteByte3 >> 4);
                notePeriod = ((noteByte1 & 0xF) << 8) | noteByte2;
                noteEffect = ((noteByte3 & 0xF) << 8) | noteByte4;

                noteIndex = 0;
                
                // Search to find note in period lookup table
                for(ss = 0; ss < 132; ss++)
                {
                    if ( (notePeriod > (periodTable[ss] - 2) ) && (notePeriod < (periodTable[ss] + 2) ) )
                    {
                        noteIndex = ss + 1;
                    }
                }

                // Adjust the index to accomodate the 9 octave system
                if (noteIndex > 0)
                {
                    noteIndex -= 24;
                }
                else
                {
                    noteIndex = 255;
                }
                
                imfData.patterns[pp].columns[jj].data[ii] =
                {
                    note       : noteIndex,
                    instrument : playSample,
                    effect     : (noteEffect >> 8),
                    effectData : (noteEffect & 0xFF),
                    volume     : 255
                };
            }
        }
    }

    // Read sample data
    for (ii = 0; ii < numSamples; ii++)
    {
        var sample8bit = new Int8Array(modData, dataOffset, imfData.samples[ii].sampleLength);
        imfData.samples[ii].data = new Float32Array(imfData.samples[ii].sampleLength);

        console.log("imfData.samples[ii].sampleLength: " + imfData.samples[ii].sampleLength + " sample8bit.length: " + sample8bit.length);
    
        // Convert signed 8-bit samples (-128 to 127) to floating point -1.0 to 1.0
        for (ss = 0; ss < sample8bit.length; ss++)
        {
            imfData.samples[ii].data[ss] = sample8bit[ss] / 128;
        }
        
        dataOffset += imfData.samples[ii].sampleLength;
    }
    
    return true;
}
