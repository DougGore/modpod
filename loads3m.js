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
Scream Tracker 3 (S3M) Loader

Purpose: Logic to read and parse Future Crew's Scream Tracker 3 (S3M) module
format.
*/

function loadS3M(modData, imfData)
{
    var OCTAVE = 12;
    
    var channelRemap = [];
    
    // Stuff we need to implement the parapointer system
    var tempParaPointer;
    var paraPointer;
    var baseLocation;

    var dataOffset = 0;
    var signature = '';
    
    var trackerVersion;
    var formatFlags;
    
    var viewData = new DataView(modData);

    imfData.header.formatShort = "S3M";
    imfData.header.formatLong = "Scream Tracker 3";
    
    for (var ii = 0x2C; ii < 0x30; ii++)
    {
        signature += String.fromCharCode(viewData.getInt8(ii));
    }
    
    // Validate signature before proceeding
    if (signature != "SCRM")
    {
        console.log("Not a S3M module");
        return false;
    }

    for (var ii = 0; ii < 28; ii++)
    {
        imfData.header.songName += String.fromCharCode(viewData.getInt8(dataOffset++));
    }
    
    // This value should be fixed at 0x1A
    if (viewData.getInt8(dataOffset++) != 0x1A)
    {
        console.log("Fixed S3M value invalid");
        return false;
    }
    
    // This value should be 16 for an S3M module
    if (viewData.getInt8(dataOffset++) != 16)
    {
        console.log("Fixed S3M value invalid (2nd)");
        return false;
    }
    
    // Skip reserved data
    dataOffset += 2;
    
    imfData.header.numPositions = viewData.getUint16(dataOffset, true);
    dataOffset += 2;
    
    imfData.header.numSamples = viewData.getUint16(dataOffset, true);
    dataOffset += 2;
    
    // Skip number of patterns (it's inaccurate)
    dataOffset += 2;
    
    // Skip old flags
    dataOffset += 2;
    
    // Skip tracker version for now (might need it later)
    trackerVersion = viewData.getUint16(dataOffset, true);
    dataOffset += 2;
    
    // Skip file format info (will need it for compatibility in future)
    dataOffset++;
    
    formatFlags = viewData.getUint8(dataOffset++);
    
    // If ScreamTracker v3.00 or 
    if ((trackerVersion == 0x1300) || (formatFlags & 0x40))
    {
        imfData.header.fastSlides = true;
    }
    else
    {
        imfData.header.fastSlides = false;
    }
    
    // We've already handled the signature
    dataOffset += 4;
    
    // Some stuff to parse here but we'll come back to it
    imfData.header.defaultSpeed = viewData.getUint8(dataOffset + 1);
    imfData.header.defaultBPM = viewData.getUint8(dataOffset + 2);
    dataOffset += 16;

    // Work out number of active channels
    for (i = 0; i < 32; i++)
    {
        if (viewData.getUint8(dataOffset++) < 16)
        {
            channelRemap[imfData.header.numChannels++] = i;
        }
        else
        {
            channelRemap[i] = 255;
        }
    }

    // Work out the real number of patterns in the module
    for(var ii = 0; ii < imfData.header.numPositions; ii++)
    {
        imfData.header.orderTable[ii] = viewData.getUint8(dataOffset++);
    
        if(imfData.header.orderTable[ii] != 255)
        {
            while (imfData.header.orderTable[ii] >= imfData.header.numPatterns)
            {
                imfData.header.numPatterns++;
            }
        }
    }

    /*
    // Convert header information to IMF
    IMFTF->Header->SongName = S3MHeader.Songname;
    IMFTF->Header->NumSamples = (BYTE)S3MHeader.NumInstruments;
    IMFTF->Header->NumChannels = NumChannels;
    IMFTF->Header->NumPatterns = NumPatterns;
    IMFTF->Header->NumPositions = (BYTE)S3MHeader.NumOrders;
    IMFTF->Header->DefaultSpeed = S3MHeader.InitialSpeed;
    IMFTF->Header->DefaultBPM = S3MHeader.InitialTempo;
    */
    imfData.header.freqType = freqTable.AMIGA;
    imfData.header.noteType = audSource.SAMPLES;

    // Build an array to hold sample information
    //Samples = new S3MSample[S3MHeader.NumInstruments];

    // Create our sample set
    //IMFTF->Samples = new _IMFSample[S3MHeader.NumInstruments];
    
    console.log("no samples: " + imfData.header.numSamples);
    
    // Read all instrument data
    for (ii = 0; ii < imfData.header.numSamples; ii++)
    {
        // Grab a parapointer and convert it to something useful
        tempParaPointer = viewData.getUint16(dataOffset, true);
        dataOffset += 2;
        
        paraPointer = tempParaPointer << 4;

        // Save our location so we can come back here
        baseLocation = dataOffset;

        // Jump to instrument record and read information
        dataOffset = paraPointer;

        sampleType = viewData.getUint8(dataOffset);
        
        imfData.samples[ii] =
        {
            sampleName      : '',
            finetune        : 0,
            volume          : 0,
            loopStart       : 0,
            loopEnd         : 0,
            loopMode        : 0,
            panning         : 0,
            relativeNote    : 0,

            sampleRate      : 0,
            bits            : 8,
            data            : null
        }

        // We only support samples, no support for adlib 
        if (sampleType == 1)
        {
        
            // Grab the MemSeg bytes
            MemSeg = viewData.getUint16(dataOffset + 0x0E, true);

            // Convert the memory segment reference into a file location pointer
            //MemSeg = ((DWORD)temp8 << 16) + temp16;

            imfData.samples[ii].sampleLength = viewData.getUint32(dataOffset + 0x10, true);
            imfData.samples[ii].finetune = viewData.getUint8(dataOffset + 2);
            imfData.samples[ii].volume = viewData.getUint8(dataOffset + 0x1C);
            imfData.samples[ii].loopStart = viewData.getUint32(dataOffset + 0x14, true);
            imfData.samples[ii].loopEnd = viewData.getUint32(dataOffset + 0x18, true);
            imfData.samples[ii].sampleRate = viewData.getUint32(dataOffset + 0x20, true); // | 0x0000FFFF;
            
            if ((imfData.samples[ii].loopEnd - imfData.samples[ii].loopStart) > 0)
            {
                imfData.samples[ii].loopMode = 1;
            }
            
            // If the loop isn't turned on then set it to zero so IMF doesn't
            // use a loop where there isn't one
            /*
            if(Samples[i].Flag & 0x1)
            {
                IMFTF->Samples[i].LoopStart = Samples[i].LoopBegin;
                IMFTF->Samples[i].LoopEnd = Samples[i].LoopEnd;
            }
            else
            {
                IMFTF->Samples[i].LoopStart = 0;
                IMFTF->Samples[i].LoopEnd = 0;
            }
            */
/*
            if(Samples[i].Flag & 0x1)
                IMFTF->Samples[i].LoopMode = 1;
            else
                IMFTF->Samples[i].LoopMode = 0;

            IMFTF->Samples[i].LoopStart = Samples[i].LoopBegin;
            IMFTF->Samples[i].LoopEnd = Samples[i].LoopEnd;
*/
        }
        
        // Copy the string otherwise your just setting a pointer
        for (var nn = 0; nn < 28; nn++)
        {
            imfData.samples[ii].sampleName += String.fromCharCode(viewData.getInt8(dataOffset + 0x30 + nn));
        }

    /*      
            // Seek to sample data and read it
            IMFTF->Samples[i].Data = new signed char[Samples[i].Length];
            fseek(fp, MemSeg<<4, SEEK_SET);

            signed char *bptr = (signed char *)IMFTF->Samples[i].Data;

            // Convert the data to signed data
            for(j=0; j<Samples[i].Length; j++)
                bptr[j] = fgetc(fp) + 128;
                */
        
        if (sampleType == 1)
        {
            dataOffset = MemSeg << 4;

            imfData.samples[ii].data = new Float32Array(imfData.samples[ii].sampleLength);
            
            // Convert signed 8-bit samples (-128 to 127) to floating point -1.0 to 1.0
            for (var ss = 0; ss < imfData.samples[ii].sampleLength; ss++)
            {
                imfData.samples[ii].data[ss] = (128 - viewData.getUint8(dataOffset++)) / 128;
            }
        }
        
        // Restore location to where we started
        dataOffset = baseLocation;
    }
    
    /*
    // Create our pattern set
    IMFTF->Patterns = new _IMFPattern[NumPatterns];
    */

    var Effect = 0;

    var PLength = 0;
    var PByte = 0;
    
    var CPattern = 0;
    var CRow = 0;
    var CChannel = 0;
    var CNote = 0;
    var CEffect = 0;
    var CEffectData = 0;
    var CExtend = 0;

    // Read pattern data
    for(i = 0; i < imfData.header.numPatterns; i++)
    {
        imfData.patterns[i] =
        {
            columns : []
        };

        // Prepare the structures ready for writing
        for(j = 0; j < imfData.header.numChannels; j++)
        {
            imfData.patterns[i].columns[j] =
            {
                channelHeight : 64,
                data : []
            }

            // Blank out the pattern
            for(k = 0; k < 64; k++)
            {
                imfData.patterns[i].columns[j].data[k] =
                {
                    note : 255,
                    instrument : 0,
                    volume : 255,
                    effect : 255,
                    effectData : 0
                }
            }       
        }

        // Grab a parapointer and convert it to something useful
        tempParaPointer = viewData.getUint16(dataOffset, true);
        dataOffset += 2;
        
        paraPointer = tempParaPointer << 4;

        // Save our location so we can come back here
        baseLocation = dataOffset;

        // Jump to instrument record and read information
        dataOffset = paraPointer;

        PLength = viewData.getUint16(dataOffset, true);
        dataOffset += 2;

        CRow = 0;
        while (CRow < 64)
        {
            PByte = viewData.getUint8(dataOffset++);
            
            if(PByte > 0)
            {
                CChannel = channelRemap[PByte & 31];

                if(CChannel != 255)
                {
                    if (PByte & 32)
                    {
                        CNote = viewData.getUint8(dataOffset++);
                        
                        if(CNote == 255)
                        {
                            imfData.patterns[i].columns[CChannel].data[CRow].note = 255;
                        }
                        else if(CNote == 254)
                        {
                            imfData.patterns[i].columns[CChannel].data[CRow].note = 254;
                        }
                        else
                        {
                            imfData.patterns[i].columns[CChannel].data[CRow].note = ((CNote >> 4) * OCTAVE) + (CNote & 0xF);
                        }
    
                        imfData.patterns[i].columns[CChannel].data[CRow].instrument = viewData.getUint8(dataOffset++);
                    }
                    
                    if (PByte & 64)
                    {
                        imfData.patterns[i].columns[CChannel].data[CRow].volume = viewData.getUint8(dataOffset++);
                    }
    
                    if (PByte & 128)
                    {
                        Effect = viewData.getUint8(dataOffset++);
                        CEffectData = viewData.getUint8(dataOffset++);

                        switch(Effect)
                        {
                        case  0: CEffect = effects.IMF_EFFECTFF; break;             // FF - No Effect
                        case  1: CEffect = effects.S3M_EFFECTA; break;              // A - Set Speed
                        case  2: CEffect = effects.PT_EFFECTB; break;               // B - Pattern Jump
                        case  3: CEffect = effects.PT_EFFECTD; break;               // C - Pattern Break
                        case  4: CEffect = effects.S3M_EFFECTD; break;              // D - S3M Volume slide
                        case  5: CEffect = effects.S3M_EFFECTE; break;              // E - S3M Porta Down
                        case  6: CEffect = effects.S3M_EFFECTF; break;              // F - S3M Porta Up
                        case  7: CEffect = effects.PT_EFFECT3; break;               // G
                        case  8: CEffect = effects.PT_EFFECT4; break;               // H - Vibrato
                        case  9: CEffect = effects.S3M_EFFECTI; break;              // I - Tremor
                        case 10: CEffect = effects.PT_EFFECT0; break;               // J - Arpeggio
                        case 11: CEffect = effects.PT_EFFECT6; break;               // K
                        case 12: CEffect = effects.PT_EFFECT5; break;               // L
                        case 13: console.log("Set Channel Volume (unimplemented)"); break;  // M
                        //case 14: break;                   // N
                        case 15: CEffect = effects.PT_EFFECT9; break;               // O - Set Sample Offset
                        case 16: console.log("Panning slide (unimplemented)"); break;   // P
                        case 17: CEffect = effects.S3M_EFFECTQ; break;              // Q - Retrig
                        case 18: CEffect = effects.PT_EFFECT7; break;               // R
                        case 19:                                                    // S
                            {
                                CEffect = effects.PT_EFFECTE;
                                CExtend = CEffectData & 0xF;
                                
                                switch(CEffectData >> 4)
                                {
                                // Used for testing, will be removed
                                case 0x0: console.log("S0: Amiga hardware effect, (unimplemented)"); break;
                                case 0x1: console.log("S1: Set glissando control  (unimplemented)"); break;
                                case 0x2: console.log("S2: Set finetune (unimplemented)"); break;
                                case 0x3: console.log("S3: Set vibrato waveform"); break;
                                case 0x4: console.log("S4: Set tremolo waveform"); break;
                                case 0x5:
                                case 0x6:
                                case 0x7:
                                    console.log("Sx: Non-existant effect"); break;
                                case 0x8: CEffect = 0xE; CEffectData = 0x80 | CExtend; break;   // S8 - Set Pan Position
                                //case 10: break;           // SA - Stereo control disabled as IMF is presently only mono
                                case 0xB: console.log("SB: Loop pattern (unimplemented)");
                                case 0xC: console.log("SC: Note cut");
                                case 0xD: CEffect = 0xE; CEffectData = 0xD0 | CExtend; break;   // SD - Note delay
                                case 0xE: CEffect = 0xE;  CEffectData = 0xF0 | CExtend; break;          // SE - Pattern Delay
                                case 0xF: console.log("Funk repeat (unimplemented)"); break;
                        
                                default: console.log("Extended S3M effect %i", (CEffectData>>4)); break;
                                }
                            } break;
                            
                        case 20: CEffect = effects.PT_EFFECTF; break;               // T
                        case 22: console.log("Set global volume (unimplemented)"); break;   // V - Set Global Volume
                        case 24: CEffect = 0xFF; break; // X - Set Panning (unsupported, ignored)
                        default:
                            {
                                console.log("Unsupported S3M effect: " + Effect);
                                CEffect = 255;
                            } break;
                        }

                        imfData.patterns[i].columns[CChannel].data[CRow].effect = CEffect;
                        imfData.patterns[i].columns[CChannel].data[CRow].effectData = CEffectData;
                    }

                }
        
            }
            else
            {
                CRow++;
            }
        }

        // Restore location to where we started
        dataOffset = baseLocation;
    }

    return true;
}