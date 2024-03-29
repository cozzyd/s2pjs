
const S2P_Element
={
  S11 : "S11", 
  S12 : "S12", 
  S21 : "S21", 
  S22 : "S22", 
};

const S2P_Parameter
={
  MAG : "MAG", 
  MAGDB : "MAGDB", 
  PHASE : "PHASE", 
  REAL : "REAL", 
  IMAG : "IMAG", 
  GRPDELAY : "GRPDELAY", 
  VSWR : "VSWR", 
};

function makeLegend(xlow,xhigh,ylow,yhigh, objs)
{
      var leg = JSROOT.Create("TLegend");
      leg.fName="legend";
      leg.fTitle="Legend";
      leg.fX1NDC = xlow;
      leg.fX2NDC = xhigh;
      leg.fY1NDC = ylow;
      leg.fY2NDC = yhigh;
      leg.fNColumns = objs.length > 12 ? 4 : objs.length > 8 ? 3 : objs.length > 3 ? 2 : 1;

      for (var i = 0; i < objs.length; i++)
      {
        var entry = JSROOT.Create("TLegendEntry");
        entry.fObject=objs[i];
        entry.fLabel=objs[i].fTitle;
        entry.fOption="lp";
        leg.fPrimitives.arr.push(entry);
      }

      return leg;
}


first_plot = true; 
f = null;
mg_mag = null;
mg_phase = null;
mg_delay = null;
mg_vswr = null; 
JSROOT.gStyle.Palette=55; 

function S2PPlot(elem_in, elem_mag, elem_phase, elem_delay, elem_vswr, insertion_only_for_phase) 
{

  f = new S2PFile(document.getElementById(elem_in).value); 
  if (!first_plot)
  {
    JSROOT.cleanup(elem_mag); 
    JSROOT.cleanup(elem_phase); 
    JSROOT.cleanup(elem_delay); 
    JSROOT.cleanup(elem_vswr); 
  }

  var do_plot = function(div, plotme, title, ytitle, directions = 0 )
  {
    if (div == null) return null; 

    var graphs = []; 
    if (directions == 1) 
    {
     graphs = [ f.makeGraph(S2P_Element.S21,plotme) ] ;
    }
    else if (directions == -1) 
    {
     graphs = [ f.makeGraph(S2P_Element.S11,plotme), f.makeGraph(S2P_Element.S22,plotme) ] ;

    }
    else
    {
      graphs = [ f.makeGraph(S2P_Element.S11,plotme), f.makeGraph(S2P_Element.S12,plotme), 
                 f.makeGraph(S2P_Element.S21,plotme), f.makeGraph(S2P_Element.S22,plotme) ];
    }

    var mg = JSROOT.CreateTMultiGraph.apply(0,graphs); 
    mg.fTitle = title; 
    JSROOT.draw(div, mg, "a plc pmc", function(p)
      {
        var hist = p.firstpainter.GetHisto(); 
        p.root_pad().fGridx=1;
        p.root_pad().fGridy=1;
        hist.fXaxis.fTitle = f.freqUnits; 
        hist.fYaxis.fTitle = ytitle; 
        JSROOT.redraw(p.divid, hist,"", function(p) 
        {
          var leg = makeLegend(0.7,1,0.9,1, graphs);
          JSROOT.draw(p.divid,leg,"same")
        });
      });

    return mg
  }

  mg_mag = do_plot(elem_mag, "MAGDB","Magnitude", "dB"); 
  mg_phase = do_plot(elem_phase, "PHASE","Phase", "Degrees",insertion_only_for_phase ?  1 : 0); 
  mg_delay = do_plot(elem_delay, "GRPDELAY","Group Delay", f.timeUnits,insertion_only_for_phase ? 1 : 0); 
  mg_vswr = do_plot(elem_vswr, "VSWR","VSWR","VSWR", -1); 


  first_plot = false; 

}


function S2PFile(txt) 
{

  var lines = txt.split("\n"); 

  this.comment = ""; 

  this.freqUnits = null; 
  this.type = null; 
  this.impedance = null; 

  this.freq = []; 

  
  this.S11 =  {"MAG":[], "MAGDB":[],  "PHASE":[], "REAL":[], "IMAG":[] };
  this.S12 =  {"MAG":[], "MAGDB":[],  "PHASE":[], "REAL":[], "IMAG":[] };
  this.S22 =  {"MAG":[], "MAGDB":[],  "PHASE":[], "REAL":[], "IMAG":[] };
  this.S21 =  {"MAG":[], "MAGDB":[],  "PHASE":[], "REAL":[], "IMAG":[] };

  this.timeUnits = "ns";

  this.makeGraph = function(element, parameter) 
  {
    


    if (parameter == "GRPDELAY") 
    {
      var unwrapped = this[element]["PHASE"].slice(0); 
      var adjust = 0; 
      for (var i = 1; i < unwrapped.length; i++) 
      {
        if (unwrapped[i] -unwrapped[i-1] + adjust  > 180) 
        {
          adjust -= 360; 
        }
        else if (unwrapped[i] - unwrapped[i-1] + adjust < -180) 
        {
          adjust +=360; 
        }

        unwrapped[i] += adjust; 
      }

      var delay = []; 
      delay[0] = 0; 
      var mult = 1; 
      if (this.freqUnits == "MHz" || this.freqUnits == "MHZ") 
      {
        mult = 1e-3;
      }

      if (this.freqUnits == "kHz" || this.freqUnits == "KHZ")
      {
        timeUnits = "ms"; 
      }

      if (this.freqUnits == "Hz" || this.freqUnits == "HZ")
      {
        mult = 1e-9; 
      }


      for (var i =1; i < unwrapped.length; i++) 
      {
        delay[i] = -(unwrapped[i]-unwrapped[i-1])/(360 * mult*(this.freq[i]-this.freq[i-1])); 
      }

      var g = JSROOT.CreateTGraph(this.freq.length, this.freq, delay); 
      g.fTitle=element + " " + parameter ;
      g.fName=element;
      g.InvertBit(JSROOT.BIT(18));
      return g; 
    }
    else if(parameter == "VSWR") 
    {
      if (element!="S11" && element!="S22") 
      {
        console.log("VSWR only makes sense for S11 or S22!"); 
        return null; 
      }

      var vswr = []; 
      var mag = this[element]["MAG"]; 
//      console.log(mag); 
      for (var i = 0; i < this.freq.length; i++) 
      {
        vswr.push ( (1 + mag[i])/(1-mag[i])); 
      }
//      console.log(vswr); 

      var g = JSROOT.CreateTGraph(this.freq.length, this.freq, vswr); 
      g.fTitle = "VSWR " + element.slice(1); 
      g.fName = element.slice(1); 
      g.InvertBit(JSROOT.BIT(18));
      return g; 

    }
    else
    {
      var g = JSROOT.CreateTGraph(this.freq.length, this.freq, this[element][parameter]); 
      g.fTitle=element + " " + parameter ; 
      g.fName=element;
      g.InvertBit(JSROOT.BIT(18));
      return g; 
    }
  }

  for (var i = 0; i < lines.length; i++) 
  {
    lines[i] = lines[i].trim(); 
    if (lines[i][0]=="!")
    {
      this.comment += lines[i] + "\n"; 
      continue; 
    }

    if (lines[i][0] == "#") 
    {
      
      var tokens = lines[i].split(/[ \t]+/); 
      console.log(tokens); 
      this.freqUnits = tokens[1]; 
      if (tokens[2] != "S") 
      {
        console.log("Only can handle scattering parameters"); 
        return; 
      }
      this.type = tokens[3]; 
      this.impedance = parseFloat(tokens[5]); 
      continue; 
    }


    var tokens = lines[i].split(/\s+/); 
    //console.log(tokens); 
    if (tokens.length != 9) continue; 
    this.freq.push(parseFloat(tokens[0]));
    if (this.type == "DB")
    {
      this.S11.MAGDB.push(parseFloat(tokens[1]));
      this.S11.PHASE.push(parseFloat(tokens[2]));
      this.S21.MAGDB.push(parseFloat(tokens[3]));
      this.S21.PHASE.push(parseFloat(tokens[4]));
      this.S12.MAGDB.push(parseFloat(tokens[5]));
      this.S12.PHASE.push(parseFloat(tokens[6]));
      this.S22.MAGDB.push(parseFloat(tokens[7]));
      this.S22.PHASE.push(parseFloat(tokens[8]));
    }

    else if (this.type="MA")
    {
      this.S11.MAG.push(parseFloat(tokens[1]));
      this.S11.PHASE.push(parseFloat(tokens[2]));
      this.S21.MAG.push(parseFloat(tokens[3]));
      this.S21.PHASE.push(parseFloat(tokens[4]));
      this.S12.MAG.push(parseFloat(tokens[5]));
      this.S12.PHASE.push(parseFloat(tokens[6]));
      this.S22.MAG.push(parseFloat(tokens[7]));
      this.S22.PHASE.push(parseFloat(tokens[8]));
    }

    else if (this.type="RI")
    {
      this.S11.REAL.push(parseFloat(tokens[1]));
      this.S11.IMAG.push(parseFloat(tokens[2]));
      this.S21.REAL.push(parseFloat(tokens[3]));
      this.S21.IMAG.push(parseFloat(tokens[4]));
      this.S12.REAL.push(parseFloat(tokens[5]));
      this.S12.IMAG.push(parseFloat(tokens[6]));
      this.S22.REAL.push(parseFloat(tokens[7]));
      this.S22.IMAG.push(parseFloat(tokens[8]));
    }
    else
    {
      console.log("Unrecognized type"); 
      break; 
    }
  }

  //now fill in the rest 

  var elems = ["S11","S21","S12","S22"];
  for (var ielem = 0 ; ielem < elems.length; ielem++ )
  {
    var elem = elems[ielem]; 
    if (this.type == "DB") 
    {
       for (var i = 0; i < this.freq.length; i++) 
       {
          var mag  = Math.pow(10, this[elem]["MAGDB"][i]/20);
          var ang = this[elem]["PHASE"][i]*Math.PI/180;
          this[elem]["MAG"][i] =mag; 
          this[elem]["REAL"][i] = mag*Math.cos(ang);
          this[elem]["IMAG"][i] = mag*Math.sin(ang);
       }
    }
    else if (this.type ="MA")
    {
      for (var i = 0; i < this.freq.length; i++) 
       {
          var mag  =this[elem]["MAG"][i]; 
          var ang = this[elem]["PHASE"][i]*Math.PI/180;
          this[elem]["MAGDB"][i] =20*Math.log10(mag); 
          this[elem]["REAL"][i] = mag*Math.cos(ang);
          this[elem]["IMAG"][i] = mag*Math.sin(ang);
       }
    }
    else if (this.type ="RI")
    {
      for (var i = 0; i < this.freq.length; i++) 
       {
          var real  =this[elem]["REAL"][i]; 
          var imag  =this[elem]["IMAG"][i]; 
          var mag = sqrt(real*real+imag*imag); 
          this[elem]["MAGDB"][i] =20*Math.log10(mag); 
          this[elem]["MAG"][i] =mag;
          this[elem]["PHASE"][i] = Math.atan2(imag,real) * 180/Math.PI; 
       }
    }
  }
}

