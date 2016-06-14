/*
  The basic rules for what needs to be availble from this student.js are:

  dataFinish: will be called once at the end of d3.csv()
  choiceSet: will be called with radioButton changes
  toggleState: will be called with clicks on states or their marks

  Beyond that, you can add and re-structure things as you see fit.
  Most of the code below is based on project 2. Places where its
  especially important to add code are marked with "(your code here)"
*/

// trying to use https://toddmotto.com/mastering-the-module-pattern/
var P3 = (function () {

  /* variable controlling map geometry; you can reduce this if you think
   it will help your depiction of which states are selected, while not
   creating too distracting a boundary between all the states */
  var HexScaling = 0.93; // hexagon scaling (1 == touching)
  /* adjusted for visual consistency */

  /* radius of circular marks in bivariate case; change this if you
   think it will make things clearer */
  var MarkRadius = 5.0;
  /* CmapLegSize and PCALegSize are set in index.html since they
   shouldn't be changed */

  /* duration, in milliseconds, of transitions between visualizations */
  var TransitionDuration = 500;

  /* other variables to track current state of visualization */
  var CmapUnivariate = false; // is current colormap univariate?
  /* you can add variables more here.  For example, how will you keep
   track of whether a state has been selected in the visualization?
   (your code here) */

  /* utility functions that should not need changing */
  var lerp = function (w, [a, b]) {
    return (1.0 - w) * a + w * b;
  }
  var unlerp = function (x, [x0, x1]) {
    return (x - x0) / (x1 - x0);
  }
  var minmax = function (arr) {
    var minval = arr[0],
      maxval = minval;
    arr.map(function (x) {
      minval = Math.min(x, minval);
      maxval = Math.max(x, maxval);
    });
    return [minval, maxval];
  }

  /* toggleState is called when you click on either a state in the map,
   or its indication in the colormap legend; the passed "state" is the
   two letter state abbreviation.  That means you can select the hexagon
   for the state with d3.select("#" + state + "hex"), and the tickmark
   for the state with d3.select("#" + state + "mark"). How you modify
   the tickmark for the state will probably depend on whether a univariate
   or a bivariate colormap is being used (CmapUnivariate) */
  var toggleState = function (state) {
    // feel free to remove this next line (for debugging)
    // console.log("toggleState(" + state + "): hello");

    if (statesSelected.indexOf(state) == -1)
      statesSelected.push(state);
    else
      statesSelected.splice(statesSelected.indexOf(state), 1); //Help from http://stackoverflow.com/questions/5767325/remove-a-particular-element-from-an-array-in-javascript

    d3.select("#mapUS").selectAll("g").select("path")
      .data(P3.data)
      .attr("stroke-opacity",
        function (d) {
          if (statesSelected.indexOf(d.State) > -1)
            return 1;
          else
            return 0;
        })
      .attr("stroke", "white")
      .attr("stroke-width", 3)
      .attr("stroke-dasharray", "7,4");

    d3.select("#cmlMarks").selectAll("ellipse")
      .data(P3.data)
      .attr("stroke",
        function (d) {
          if (statesSelected.indexOf(d.State) > -1) {
            return "white";
            console.log("CML");
          } else
            return "black";
        });

  }

  var statesSelected = [];

  /* PCA: computes PCA of given array of arrays.
   uses http://www.numericjs.com for linear algebra */
  var PCA = function (dcols) {
      if (dcols.length < 3) {
        d3.select("#pcaWarning").html("PCA() needs at least 3 variables (got " + dcols.length + ")");
        return null;
      }
      /* else got enough variables */
      d3.select("#pcaWarning").html("");
      // dcols: (short) array of (long) data arrays (each element ~ a csv column)
      // drows: (long) array of data vectors (each element ~ a csv row)
      var drows = numeric.transpose(dcols);
      // covar: covariance matrix
      var covar = numeric.dot(dcols, drows);
      /* NOTE: numeric.dot is for matrix multiplication in general,
       which includes matrix-matrix multiply (as above), and
       matrix-vector multiply, as well as
       vector-vector (inner) product, which you might want to use for
       compute coordinates in the basis of PCA eigenvectors */
      // nmeig: numeric.js's eigensystem representation of covar
      var nmeig = numeric.eig(covar);
      /* NOTE: If you see in the javascript console:
       "Uncaught Error: numeric: eigenvalue iteration does not converge -- increase maxiter?"
       then it is likely that one or more values being passed to
       numeric.eig(covar) are not numeric (e.g. "NaN"), which can happen if
       one or more values in dcols are not numeric */
      // evec: array of covariance matrix eigenvectors (unit-length)
      var evec = numeric.transpose(nmeig.E.x);
      // evec: array of corresponding eigenvalues
      var eval = nmeig.lambda.x;
      // esys: zipping up each component of eigensysem into a little object:
      // "l" for eigenvalue, "v" eigenvector, and "mm" for zero-centered range
      // of projections of data into that eigenvector
      var esys = eval.map(function (_, i) {
        var mindot = 0,
          maxdot = 0;
        drows.map(function (_, j) { // learn range of projections
          var x = numeric.dot(drows[j], evec[i]);
          mindot = Math.min(mindot, x);
          maxdot = Math.max(maxdot, x);
        });
        // center range around zero
        var mmin = Math.min(mindot, -maxdot);
        var mmax = Math.max(-mindot, maxdot);
        // make sure the range itself is non-zero
        if (mmin == mmax) {
          mmin = -1;
          mmax = 1;
        }
        return {
          "l": eval[i],
          "v": evec[i],
          // simplify needlessly precise representation of range
          "mm": [d3.format(".3f")(mmin), d3.format(".3f")(mmax)]
        };
      });
      // sort eigensystem in descending eigenvalue order
      esys.sort(function (a, b) {
        var x = a.l;
        var y = b.l;
        return ((x < y) ? 1 : ((x > y) ? -1 : 0));
      });
      return esys;
    }
    /* useful average function defined outside */

  function average(data) {
    var sum = data.reduce(function (sum, value) {
      return sum + value;
    }, 0);

    var avg = sum / data.length;
    return avg;
  }

  /* dataNorm should take an array of scalar data values and return an
   array resulting from two transformations:
   1) subtract out the mean
   2) make the variance 1
   Making the variance 1 means that no data variable will out an outsized
   influence on the PCA just because of a choice of units: multiplying a
   variable by 10 won't change its information content, but it would
   increase that variable's role in a PCA. */
  /* Thanks http://stackoverflow.com/questions/21603070/r-normalize-mean-0-variance-1-function-that-can-be-used-with-apply-on-arbi
and https://derickbailey.com/2014/09/21/calculating-standard-deviation-with-array-map-and-array-reduce-in-javascript/ */
  function dataNorm(arr) {
    arr = arr.map( function(data) {
      return +data;
    });
    var avg = average(arr);
    var squareDiffs = arr.map(function (value) {
      var diff = value - avg;
      var sqrDiff = diff * diff;
      return sqrDiff;
    });
    var avgSquareDiff = average(squareDiffs);
    var stdDev = Math.sqrt(avgSquareDiff);
    //console.log("arr:" + arr + ", avg:" + avg + ", squareDiffs:" + squareDiffs + ", avgSquareDiff:" + avgSquareDiff + ", stdDev:" + stdDev);
    //console.log(arr);
    var ret = arr.map(function(x) {
    x = x - avg;
    return x / stdDev;
    });

    return (ret);
  }

  //console.log(dataNorm([100,2000,-3,40,5999]));

  /* (from Project2 solution) some stuff we can use for each
   * univariate map.  Feel free to ignore/delete this function
   * if you want to structure things differently */
  var stuff = function (what, mmGiven) {
    var sel = function (d) {
      return +d[what]
    }
    var slc = P3.data.map(sel);
    var mm = ((typeof mmGiven === 'undefined') ? minmax(slc) // mmGiven not passed, find min,max
      : mmGiven); // use given mmGiven
    return {
      "select": sel,
      "minmax": mm,
      "cmlscl": d3.scale.linear().domain(mm).range([0, P3.CmapLegSize - 1]),
    };
  }

  /* for univariate pca map */
  var stuffpcauni = function (what, pcadcols, drows, pca) {
  	var mm = pcadcols[pca]['mm'];
    var sel = function (d) {
      return +d[what];
    }
  	return {
  		"select": sel,
  		"minmax": mm,
  		"cmlscl": d3.scale.linear().domain(mm).range([0, P3.CmapLegSize - 1]),
  	};
  }

  var dataFinish = function (data) {
    /* save data for future reference (for simplicity, from here on
       out P3.data is the only way we'll refer to the data) */
    P3.data = data;

    /* much of the code here is from Project2 reference solution
       http://people.cs.uchicago.edu/~glk/ class/DataVis/p2.js
       but you should feel free to modify/augment/edit it as you
       see fit for your work (your code here) */
    var voteTotMax = 0;
    P3.data.map(function (d) {
      var VT = +d["ObamaVotes"] + +d["RomneyVotes"];
      d["VT"] = VT;
      d["PL"] = +d["ObamaVotes"] / (1.0 + VT);
      voteTotMax = Math.max(voteTotMax, VT);
    });
    P3.data.map(function (d) {
      d["VA"] = 1 - Math.pow(1 - d["VT"] / voteTotMax, 3);
    });

    /* learn earnings ranges */
    P3.earnWMinMax = minmax(P3.data.map(function (d) {
      return +d["WE"]
    }));
    P3.earnMMinMax = minmax(P3.data.map(function (d) {
      return +d["ME"]
    }));

    /* obesity-related things */
    P3.obeseStuff = stuff("OB");
    var _obeseCmap = d3.scale.linear() /* colormap prior to quantization */
      .domain([0, 0.4, 1])
      .range([d3.rgb(100, 200, 100), d3.rgb(220, 220, 210), d3.rgb(130, 0, 0)]);
    P3.obeseCmap = function (r) {
      var w0 = Math.round(lerp(unlerp(r, P3.obeseStuff["minmax"]), [-0.5, 6.5]));
      return _obeseCmap(unlerp(Math.min(6, w0), [-0.5, 6.5]));
    }

    /* create unemployment colormap */
    P3.unempStuff = stuff("UN");
    P3.unempCmap = d3.scale.linear()
      .domain([0, 1 / 3, 2 / 3, 1].map(function (w) {
        return lerp(w, P3.unempStuff["minmax"]);
      }))
      .range([d3.rgb(0, 0, 0), d3.rgb(210, 0, 0), d3.rgb(255, 210, 0), d3.rgb(255, 255, 255)]);

    /* create infant mortality map */
    P3.imortStuff = stuff("IM");
    P3.imortCmap = function (d) {
      var scl = d3.scale.linear().domain(P3.imortStuff["minmax"]);
      return d3.hcl(scl.range([330, -15])(d),
        25 * Math.pow(Math.sin(scl.range([0, 3.14159])(d)), 2),
        scl.range([0, 100])(d));
    }

    /* create univariate voter maps */
    P3.pleanStuff = stuff("PL", [0, 1]);
    var Dhcl = d3.hcl(d3.rgb(0, 0, 210));
    var Rhcl = d3.hcl(d3.rgb(210, 0, 0));
    P3.pleanCmap = function (x) {
      return d3.hcl(x < 0.5 ? Rhcl.h : Dhcl.h, (x < 0.5 ? Rhcl.c : Dhcl.c) *
        (1 - Math.pow(1 - (Math.abs(x - 0.5) / 0.5), 4)),
        lerp(x, [Rhcl.l, Dhcl.l]));
    }

    /* create bivariate voter map */
    P3.plean2Cmap = function ([pl, va]) {
      var col = P3.pleanCmap(pl);
      return d3.hcl(col.h, lerp(va, [0, col.c]), lerp(va, [100, col.l]));
    }

    /* create bivariate earnings maps */
    P3.ERcmap = function ([mm, ww]) {
      var erw = unlerp(ww, P3.earnWMinMax);
      var erm = unlerp(mm, P3.earnMMinMax);
      return d3.lab(25 + 40 * (erw + erm), 0, 170 * (erm - erw));
    }

    /* NOTE: any elements set up in index.html can be modified here,
       prior to any calls to choiceSet.  For example, to change the
       fill in all the #cmlMarks ellipses to pink, you could:

       d3.select("#cmlMarks").selectAll("ellipse")
         .data(P3.data)
         .attr("fill", "pink");

       Or, to add zero-opacity white dashed stroke around each state's
       hexagon (the "path" inside the per-state "g" in "#mapUS"):


    */

  }
  /* Thanks http://stackoverflow.com/questions/12503146/create-an-array-with-same-element-repeated-multiple-times-in-javascript?lq=1 */
  function fillArray(value, len) {
    var arr = [];
    for (var i = 0; i < len; i++) {
      arr.push(value);
    }
    return arr;
}
/* Thanks http://stackoverflow.com/questions/5649803/remap-or-map-function-in-javascript */
function map_range(value, low1, high1, low2, high2) {
  return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}

  function timeoutFn() {
    P3.cmlContext.putImageData(P3.cmlImage, 0, 0)
  }
  var choiceSet = function (wat, pvars) {
    //  console.log(wat, pvars); // feel free to remove this debugging line

    if (wat.startsWith("PC")) {

      if (pvars.length < 1) {
        d3.select("#pcaWarning").html("Select at least one variable below for PCA");
        return;
      }
      d3.select("#pcaWarning").html("");
      /* Else we have at least one variable for PCA; so we do that here,
           in the following steps:
           1) make an array (suppose its called "dcols") of the result
           of calling dataNorm() on each data variable (your code here)
           (can be as little as 3 lines) */

      var len = pvars.length; /* not sure if this is where you get length */
      var unnormalized;
      var dcols = [len];
      for (var i = 0; i < len; i++) {
        // d3.select("#pca" + pvars[i]).attr("opacity", 1).transition().delay(TransitionDuration);
        unnormalized = [];
        for (var j = 0; j < 51; j++) {
          unnormalized.push(P3.data[j][pvars[i]]);
        }
        // console.log(unnormalized);
        dcols[i] = dataNorm(unnormalized);

      }
      /* 2) If less than 3 variables were selected for PCA, add to "dcols"
           one or two arrays of zeros, so that PCA() has at least three
           data variables to work on (your code here) (a few lines) */
      if (len < 2) {
        dcols[1] = [];
        for (var i = 0; i < 51; i++) {
          dcols[1].push(0);
        }
      }
      if (len < 3) {
        dcols[2] = [];
        for (var i = 0; i < 51; i++) {
          dcols[2].push(0);
        }
      }
// console.log(dcols);

      /* 3) call PCA(dcols), and add to P3.data the coordinates of each
           datum in the basis of the first three principle components.  Note
           that "var drows = numeric.transpose(dcols)" will get you an array
           of per-state data (row) vectors, and then with
           "P3.data.map(function(d,ii) { })" you can set PCA coordinate
           fields in per-state datum "d" from the dot product between
           drows[ii] and the PCA eigenvectors. Visualizing the PCA
           results should use these PCA coordinates in the same way that
           in the previous project you used the original data variables.
           (your code here) (roughly ~20 lines of code) *3 */

      /* map data to P3.data */

      var pcadcols = PCA(dcols);
       console.log(pcadcols);

      var drows = numeric.transpose(dcols);
      console.log(drows);

      P3.data.map(function(d,ii) {
        d.PC0 =0;
        d.PC1 =0;
        d.PC2 =0;
        d.PC01 = 0;
        d.PC02 = 0;
        d.PC12 = 0;
        for (var i = 0; i < pcadcols.length; i++) {
          d.PC0 += pcadcols[0]['v'][i] * drows[ii][i];
          d.PC1 += pcadcols[1]['v'][i] * drows[ii][i];
          d.PC2 += pcadcols[2]['v'][i] * drows[ii][i];
          d.PC01 = [d.PC0, d.PC1];
          d.PC02 = [d.PC0, d.PC2];
          d.PC12 = [d.PC1, d.PC2];
        }

      });

     /* colormaps for all PCA data */
     P3.PC0Stuff = stuffpcauni("PC0", pcadcols, drows, 0);
     P3.PC0Cmap = d3.scale.linear()
      .domain([0, 0.5, 1].map(function (x) {
        return lerp(x, P3.PC0Stuff["minmax"]);
      }))
      .range([d3.rgb(255, 0, 0), d3.rgb(204, 120, 0), d3.rgb(255, 255, 0)]);

      P3.PC1Stuff = stuffpcauni("PC1", pcadcols, drows, 1);
      P3.PC1Cmap = d3.scale.linear()
        .domain([0, 0.5, 1].map(function (x) {
          return lerp(x, P3.PC1Stuff["minmax"]);
        }))
        .range([d3.rgb(204, 0, 0), d3.rgb(204, 120, 0), d3.rgb(204, 204, 0)]);

	   P3.PC2Stuff = stuffpcauni("PC2", pcadcols, drows, 2);
     P3.PC2Cmap = d3.scale.linear()
       .domain([0, 0.5, 1].map(function (x) {
         return lerp(x, P3.PC2Stuff["minmax"]);
       }))
       .range([d3.rgb(204, 0, 0), d3.rgb(204, 120, 0), d3.rgb(204, 204, 0)]);

     P3.PC01Cmap = function ([PC0, PC1]) {
       var erw = unlerp(PC0, mmx);
       var erm = unlerp(PC1, mmy);
      //  if (mmx == null || mmx == undefined || mmy == null || mmy == undefined) console.log("eek");
       return d3.lab(25 + 40 * (erw + erm), 0, 170 * (erm - erw));
     }

     P3.PC02Cmap = function ([PC0, PC2]) {
       var erw = unlerp(PC0, mmx);
       var erm = unlerp(PC2, mmy);
       return d3.lab(25 + 40 * (erw + erm), 0, 170 * (erm - erw));
     }

     P3.PC12Cmap = function ([PC1, PC2]) {
       var erw = unlerp(PC1, mmx);
       var erm = unlerp(PC2, mmy);
       return d3.lab(25 + 40 * (erw + erm), 0, 170 * (erm - erw));
     }

      //map data across states by calculating data product between PCA component 0 and the state value result in drows //

      // P3.data.map(function(d, ii))

      /* 4) Visualize what the PCA did with the given data variables inside
           the #pcaMarks svg by changing the text element #pcaXX for
           all variables XX (selected via d3.select("#pca" + XX)):
           a) Make the text opaque for the variables actually included in
           the PCA, and transparent for the rest.
           b) For the variables in PCA, move the text to a position that
           indicates how that variable is aligned with the principle
           component(s) shown (one component for PC0, PC1, PC2, and
           two components for PC01, PC02, PC12). Compute this by forming
           a vector of length pvars.length which is all 0s except for 1 at
           the index of XX in pvars, and then using numeric.dot() to get
           the dot product with a principle component eigenvector. Since
           this is the dot product of two unit-length vectors, the result
           should be in [-1,1], which you should map to coordinates
           [30,P3.PCALegSize-30]) in X or [P3.PCALegSize-30,30]) in Y.
           Text is moved by modifying the "transform" attribute to
           "translate(cx,cy)" for position (cx,cy). For variables not
           in the PCA, the text should be moved back to the center at
           (P3.PCALegSize/2,P3.PCALegSize/2).  You can iterate over the
           #pcaXX with "P3.PCAVars.map(function(XX) { })".
           Changes to both opacity and position should also be made via a
           transition of duration TransitionDuration.  (your code here)
           (roughly ~30 lines of code) */

      /* calculations for vectors for cross marks */
      d3.select("#pcaMarks").selectAll("text").transition().duration(TransitionDuration).style("opacity", 0).attr("x", 0).attr("y", 0);
      var x = P3.PCALegSize/2;
      switch (wat) {
          case "PC0":
          for (var i = 0; i < len; i++) {
            var vector = fillArray(0, len);
            vector[i] = 1;
            var loc = map_range(numeric.dot(vector, pcadcols[0]['v']), -1, 1, 30, P3.PCALegSize-30);
            d3.select("#pca" + pvars[i]).transition().duration(TransitionDuration).style("opacity", 1).attr("transform", "translate(" + loc + ", " + x + ")");
          }
          break;
          case "PC1":
            for (var i = 0; i < pvars.length; i++) {
              var vector = fillArray(0, len);
              vector[i] = 1;
              var loc = map_range(numeric.dot(vector, pcadcols[1]['v']), -1, 1, 30, P3.PCALegSize-30);
              d3.select("#pca" + pvars[i]).transition().duration(TransitionDuration).style("opacity", 1).attr("transform", "translate(" + loc + ", " + x + ")");
            }
        break;
          case "PC2":
            for (var i = 0; i < pvars.length; i++) {
              var vector = fillArray(0, len);
              vector[i] = 1;
              var loc = map_range(numeric.dot(vector, pcadcols[2]['v']), -1, 1, 30, P3.PCALegSize-30);
              d3.select("#pca" + pvars[i]).transition().duration(TransitionDuration).style("opacity", 1).attr("transform", "translate(" + loc + ", " + x + ")");
            }
        break;
          case "PC01":
            for (var i = 0; i < pvars.length; i++) {
              var vector = fillArray(0, len);
              vector[i] = 1;
              var locx = lerp(unlerp((numeric.dot(vector, pcadcols[0]['v'])), [-1, 1]), [30,P3.PCALegSize-30]);
              var locy = lerp(unlerp((numeric.dot(vector, pcadcols[1]['v'])), [-1, 1]), [30,P3.PCALegSize-30]);
              d3.select("#pca" + pvars[i]).transition().duration(TransitionDuration).style("opacity", 1).attr("transform", "translate(" + locx + ", " + locy + ")");
            }
        break;
          case "PC02":
              for (var i = 0; i < pvars.length; i++) {
                var vector = fillArray(0, len);
                vector[i] = 1;
                var locx = lerp(unlerp((numeric.dot(vector, pcadcols[0]['v'])), [-1, 1]), [30,P3.PCALegSize-30]);
                var locy = lerp(unlerp((numeric.dot(vector, pcadcols[2]['v'])), [-1, 1]), [30,P3.PCALegSize-30]);
                d3.select("#pca" + pvars[i]).transition().duration(TransitionDuration).style("opacity", 1).attr("transform", "translate(" + locx + ", " + locy + ")");
              }
        break;
          case "PC12":
              for (var i = 0; i < pvars.length; i++) {
                var vector = fillArray(0, len);
                vector[i] = 1;
                var locx = map_range(numeric.dot(vector, pcadcols[1]['v']), -1, 1, 30, P3.PCALegSize-30);
                var locy = map_range(numeric.dot(vector, pcadcols[2]['v']), -1, 1, 30, P3.PCALegSize-30);
                d3.select("#pca" + pvars[i]).transition().duration(TransitionDuration).style("opacity", 1).attr("transform", "translate(" + locx + ", " + locy + ")");
              }
        break;
       }
       /* need to find a way to reset these values back after using them */
    } else {
      d3.select("#pcaWarning").html("")
        .transition().delay(TransitionDuration);
                    d3.select("#pcaMarks").selectAll("text").transition().duration(TransitionDuration).style("opacity", 0).attr("x", 0).attr("y",0);
    }

    /* is this a univariate map? */
    CmapUnivariate = (["OB", "UN", "IM", "VU", "PC0", "PC1", "PC2"].indexOf(wat) >= 0);

    /* set the colormapping function */
    var colormap = {
      "OB": P3.obeseCmap,
      "UN": P3.unempCmap,
      "IM": P3.imortCmap,
      "VU": P3.pleanCmap,
      "VB": P3.plean2Cmap,
      "ER": P3.ERcmap,
      "PC0": P3.PC0Cmap,
      "PC1": P3.PC1Cmap,
      "PC2": P3.PC2Cmap,
      "PC01": P3.PC01Cmap,
      "PC02": P3.PC02Cmap,
      "PC12": P3.PC12Cmap,
    }[wat];
    var cml, cmlx, cmly, sel, mmx, mmy;
    if (CmapUnivariate) {
      var stf = {
        "OB": P3.obeseStuff,
        "UN": P3.unempStuff,
        "IM": P3.imortStuff,
        "VU": P3.pleanStuff,
        "PC0": P3.PC0Stuff,
        "PC1": P3.PC1Stuff,
        "PC2": P3.PC2Stuff,
      }[wat];
        [cml, mmx, sel] = [stf["cmlscl"], stf["minmax"], stf["select"]];
      mmy = null;
    } else {
      cml = mmx = mmy = sel = null;
    }
    /* handle the bivariate cases */
    switch (wat) {
    case "VB":
      cmlx = cmly = d3.scale.linear().domain([0, 1]).range([0, P3.CmapLegSize - 1]);
      mmx = mmy = [0, 1];
      sel = function (d) {
        return [+d.PL, +d.VA]
      };
      break;
    case "ER":
      cmlx = d3.scale.linear().domain(P3.earnMMinMax).range([0, P3.CmapLegSize - 1]);
      cmly = d3.scale.linear().domain(P3.earnWMinMax).range([0, P3.CmapLegSize - 1]);
      mmx = P3.earnMMinMax;
      mmy = P3.earnWMinMax;
      sel = function (d) {
        return [+d.ME, +d.WE]
      };
      break;
    /* add bivariate colormaps for pca 0 and 1 */
    case "PC01":
      mmx = pcadcols[0]['mm'];
      // console.log(pcadcols[0]['mm']);
      mmy = pcadcols[1]['mm'];
      cmlx = cmly = d3.scale.linear().domain(mmx).range([0, P3.CmapLegSize - 1]);
      cmly = d3.scale.linear().domain(mmx).range([0, P3.CmapLegSize - 1]);
      sel = function (d) {
        return [+d.PC0, +d.PC1];
      };
      break;
    case "PC02":
      mmx = pcadcols[0]['mm'];
      mmy = pcadcols[2]['mm'];
      cmlx = d3.scale.linear().domain(mmx).range([0, P3.CmapLegSize - 1]);
      cmly = d3.scale.linear().domain(mmx).range([0, P3.CmapLegSize - 1]);
      sel = function (d) {
        return [+d.PC0, +d.PC2]
      };
      break;
    case "PC12":
      mmx = pcadcols[1]['mm'];
      mmy = pcadcols[2]['mm'];
      cmlx = d3.scale.linear().domain(mmx).range([0, P3.CmapLegSize - 1]);
      cmly = d3.scale.linear().domain(mmx).range([0, P3.CmapLegSize - 1]);
      sel = function (d) {
        return [+d.PC1, +d.PC2]
      };
      break;
    }

    /* 1) reapply colorDatum to the "fill" of the states in #mapUS.
       be sure to add a transition that lasts TransitionDuration */
    d3.select("#mapUS").selectAll("path")
      .data(P3.data)
      .transition().delay(TransitionDuration)
      .style("fill", function (d) {
       //console.log(sel(d));
        //console.log(colormap(sel(d)));
        return colormap(sel(d));
      });

    /* 2) reset pixels of cmlImage.data, and redisplay it with
       P3.cmlContext.putImageData(P3.cmlImage, 0, 0); */
    if (CmapUnivariate) {
      for (var j = 0, k = 0, c; j < P3.CmapLegSize; ++j) {
        for (var i = 0; i < P3.CmapLegSize; ++i) {
          if (0 == j) {
            c = d3.rgb(colormap(cml.invert(i)));
            P3.cmlImage.data[k++] = c.r;
            P3.cmlImage.data[k++] = c.g;
            P3.cmlImage.data[k++] = c.b;
            P3.cmlImage.data[k++] = 255;
          } else {
            P3.cmlImage.data[k] = P3.cmlImage.data[(k++) - 4 * P3.CmapLegSize];
            P3.cmlImage.data[k] = P3.cmlImage.data[(k++) - 4 * P3.CmapLegSize];
            P3.cmlImage.data[k] = P3.cmlImage.data[(k++) - 4 * P3.CmapLegSize];
            P3.cmlImage.data[k] = 255;
            k++;
          }
        }
      }
    } else {
      for (var j = 0, k = 0, c; j < P3.CmapLegSize; ++j) {
        for (var i = 0; i < P3.CmapLegSize; ++i) {
          c = d3.rgb(colormap([cmlx.invert(i),
                                     cmly.invert(P3.CmapLegSize - 1 - j)]));
          P3.cmlImage.data[k++] = c.r;
          P3.cmlImage.data[k++] = c.g;
          P3.cmlImage.data[k++] = c.b;
          P3.cmlImage.data[k++] = 255;
        }
      }
    }
    //Used http://stackoverflow.com/questions/24849/is-there-some-way-to-introduce-a-delay-in-javascript for help on this function.
    window.setTimeout(function () {
      timeoutFn();
    }, TransitionDuration);

    /* 3) set d3.select("#xminlabel").html(), and similarly for the other
       three labels, to reflect the range of values that are
       colormapped when displaying "wat".  For univariate maps,
       set xminlabel and yminlabel to show the range, and set
       yminlabel and ymaxlabel to an empty string.  For bivariate
       maps, set all labels to show the X and Y ranges. */
    d3.select("#xminlabel").html("<text>" + mmx[0] + "</text>");
    d3.select("#xmaxlabel").html("<text>" + mmx[1] + "</text>");
    if (CmapUnivariate) {
      d3.select("#yminlabel").html("<text></text>");
      d3.select("#ymaxlabel").html("<text></text>");
    } else {
      d3.select("#yminlabel").html("<text>" + mmx[0] + "</text>");
      d3.select("#ymaxlabel").html("<text>" + mmx[1] + "</text>");
    }

    /* 4) update the geometric attributes (rx, ry, cx, cy) of the #cmlMarks
       to indicate the data variables, and any other attributes you want
       to control according to whether the state is selected. Changes should
       happen with a transition of duration TransitionDuration.
       (your code here) (or interspersed below) */
    if (CmapUnivariate) {
      d3.select("#cmlMarks").selectAll("ellipse")
        .data(P3.data)
        .transition().delay(TransitionDuration)
        .attr("rx", 0.05) // if zero, outline may disappear
      .attr("ry", P3.CmapLegSize / 4)
        .attr("cx", function (d) {
          return 0.5 + cml(sel(d));
        })
        .attr("cy", P3.CmapLegSize / 2);
    } else {
      d3.select("#cmlMarks").selectAll("ellipse")
        .data(P3.data)
        .transition().delay(TransitionDuration)
        .attr("rx", MarkRadius).attr("ry", MarkRadius)
        .attr("cx", function (d) {
          return 0.5 + cmlx(sel(d)[0]);
        })
        .attr("cy", function (d) {
          return P3.CmapLegSize - 0.5 - cmly(sel(d)[1]);
        });
    }
  }

  /* shouldn't have to change anything from here on */
  return { // the P3 "API"
    HexScaling: HexScaling,
    choiceSet: choiceSet,
    dataFinish: dataFinish,
    toggleState: toggleState,
  };

})(); // end "var P3=(function () {" module container

/* Answer questions here. Each should be no more than ~40 words.

#1) Concisely describe and justify your method of indicating, in the map
and in the colormap, whether a state is selected.

A selected state is surrounded by a dotted line. A selected colormap line/circle is colored white rather than black.


#2) In the terminology of "An Algebraic Process for Visualization
Design" (class May 26), what is one "confuser" for PCA as it it used
in this project (i.e. a particular change in the data that will have
no significant effect on the PCA result)?  (hint: think about what
dataNarm() does, and how the covariance matrix is computed).  There
are at least three possible answers.

From the persepctive of the viewer, the unnormalized versus the normalized data is one confuser that will not have a significant effect on the result.


#3) Concisely describe and justify your design of colormaps for the
univariate and bivarite cases of PCA visualization.

As the PCA visualizations are interval values, for univariate data, we decided to interpolate between a dark shade of red and yellow for the x values, and a blue and a yellow for the y values, creating a map. This is because we wanted to see the subtle differences in the colors for the maps on a non meaningful 0 point.

For the bivariate data, we decided to use the same LAB colormap as was used before for the ER map. This is for ease of creating a bivariate map as well as justifying and making sure that the interval ratios were kept consistently.


#4) Based on exploring the data with PCA, what was a result that you found
from PCA of three or four variables?  Describe your result in terms of
which variables had similar vs complementary contributions to the PCA,
or the geographic trend you saw in the map.

For PCA #0, both the combos OB, UN, and IM as well as ME, WE, GS has very similar contributions to PCA 0 which was interesting. I guess that should be expected since they are similar values. However, for PCA #1, ME, WE, separately from OB were dissimilar for PCA #0, showing that maybe obesity is not correlated with earnings.

For the bivariate data, it was slightly hard to tell for multiple variables. For the combos OB, UN, and IM, PCA(0,1), OB and IM seemed to be more closely correlated than OB and UN or UN and IM from what I could tell from the colormaps (though they differed for each 0,1 and 0,2 and 1,2). For ME, WE, GS, ME and WE seemed to be more closely correlated with PCA components (0,1), however, for PCA(0,2) and PCA(1,2), ME and WE differed more and ME and WE were more similar to GS, respectively.



(extra credit) #5) How did you maximize visual consistency when switching
between PCA and other radio buttons?



*/
