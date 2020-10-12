import legend from "./legend.js"
import colourBar from "./colourBar.js"
import scaleBar from "./scaleBar.js"

import { renameText } from "./utils.js"

import * as api from "./api.js"

export default function clusterMap() {
  /* A ClusterMap plot. */

  let container = null
  let transition = d3.transition()

  api.plot.update = () => container.call(my)

  function my(selection) {
    selection.each(function(data) {

      // Save the container for later updates
      container = d3.select(this)
        .attr("width", "100%")
        .attr("height", "100%")

      // Set up the shared transition
      transition = d3.transition()
        .duration(api.config.plot.transitionDuration)

      // Build the figure
      let plot = container.selectAll("svg.clusterMap")
        .data([data])
        .join(
          enter => {
            // Add HTML colour picker input
            enter.append("input")
              .attr("id", "picker")
              .attr("class", "colourPicker")
              .attr("type", "color")
              .style("opacity", 0)

            // Add root SVG element
            let svg = enter.append("svg")
              .attr("class", "clusterMap")
              .attr("id", "root-svg")
              .attr("cursor", "grab")
              .attr("width", "100%")
              .attr("height", "100%")
              .attr("xmlns", "http://www.w3.org/2000/svg")
              .attr("xmlns:xhtml", "http://www.w3.org/1999/xhtml")

            let g = svg.append("g")
              .attr("class", "clusterMapG")

            // Attach pan/zoom behaviour
            let zoom = d3.zoom()
              .scaleExtent([0, 8])
              .on("zoom", event => g.attr("transform", event.transform))
              .on("start", () => svg.attr("cursor", "grabbing"))
              .on("end", () => svg.attr("cursor", "grab"))
            let transform = d3.zoomIdentity
              .translate(20, 50)
              .scale(1.2)
            svg.call(zoom)
              .call(zoom.transform, transform)
              .on("dblclick.zoom", null)

            return g
          },
          update => update.call(
            update => {
              update
                .transition(transition)
                .call(api.plot.arrange)
            })
        )

      api.scale.update(data)
      api.link.updateGroups(data.links)

      container = d3.select(this)

      let linkGroup = plot.selectAll("g.links")
        .data([data])
        .join("g")
        .attr("class", "links")

      let clusterGroup = plot.selectAll("g.clusters")
        .data([data.clusters])
        .join("g")
        .attr("class", "clusters")

      let clusters = clusterGroup
        .selectAll("g.cluster")
        .data(data.clusters, d => d.uid)
        .join(
          enter => {
            enter = enter.append("g")
              .attr("id", api.cluster.getId)
              .attr("class", "cluster")
              .each(initialiseData)
            let info = enter.append("g")
              .attr("id", c => `cinfo_${c.uid}`)
              .attr("class", "clusterInfo")
              .attr("transform", `translate(-10, 0)`)
              .call(api.cluster.drag)
            info.append("text")
              .text(c => c.name)
              .attr("class", "clusterText")
              .on("click", renameText)
            info.append("text")
              .attr("class", "locusText")
            enter.append("g")
              .attr("class", "loci")
            return enter
              .call(api.style.cluster)
              .call(api.cluster.update)
          },
          update => update.call(
            update => update
              .transition(transition)
              .call(api.cluster.update)
          )
        )

      let loci = clusters.selectAll("g.loci")
        .selectAll("g.locus")
        .data(d => d.loci, d => d.uid)
        .join(
          enter => {
            enter = enter.append("g")
              .attr("id", api.locus.getId)
              .attr("class", "locus")
            enter.append("line")
              .attr("class", "trackBar")
            let hover = enter.append("g")
              .attr("class", "hover")
            enter.append("g")
              .attr("class", "genes")
            hover.append("rect")
              .attr("class", "hover")
              .call(api.locus.dragPosition)
            hover.append("rect")
              .attr("class", "leftHandle")
              .call(api.locus.dragResize)
            hover.append("rect")
              .attr("class", "rightHandle")
              .call(api.locus.dragResize)
            enter
              .on("mouseenter", event => {
                if (api.flags.isDragging) return
                d3.select(event.target)
                  .select("g.hover")
                  .transition()
                  .attr("opacity", 1)
              })
              .on("mouseleave", event => {
                if (api.flags.isDragging) return
                d3.select(event.target)
                  .select("g.hover")
                  .transition()
                  .attr("opacity", 0)
              })
              .on("dblclick", (_, d) => {
                api.locus.flip(d)
                api.plot.update()
              })
            return enter
              .call(api.style.locus)
              .call(api.locus.update)
          },
          update => update.call(
            update => update.transition(transition)
              .call(api.locus.update)
          )
        )

      loci.selectAll("g.genes")
        .selectAll("g.gene")
        .data(d => d.genes, d => d.uid)
        .join(
          enter => {
            enter = enter.append("g")
              .attr("id", api.gene.getId)
              .attr("class", "gene")
            enter.append("polygon")
              .on("click", api.config.gene.shape.onClick)
              .attr("class", "genePolygon")
            enter.append("text")
              .text(g => g.name)
              .attr("class", "geneLabel")
            return enter
              .call(api.style.gene)
              .call(api.gene.update)
          },
          update => update.call(update => update.transition(transition)
            .call(api.gene.update))
        )

      linkGroup.selectAll("path.geneLink")
        .data(data.links, api.link.getId)
        .join(
          enter => enter.append("path")
            .attr("id", api.link.getId)
            .attr("class", "geneLink")
            .style("fill", d => api.scales.score(d.identity))
            .call(api.style.link)
            .call(api.link.setPath),
          update => update.call(
            update => update
              .transition(transition)
              .call(api.link.setPath, true)
          )
        )

      let legendFn = getLegendFn()
      let scaleBarFn = getScaleBarFn()
      let colourBarFn = getColourBarFn()

      plot
        .call(legendFn)
        .call(colourBarFn)
        .call(scaleBarFn)
        .call(api.plot.arrange)
    })
  }

  function initialiseData(cluster) {
    cluster.loci.forEach(locus => {
      locus._start = locus.start
      locus._end = locus.end
      locus._offset = 0
      locus._cluster = cluster.uid
      locus._flipped = false
      locus.genes.forEach(gene => {
        gene._locus = locus.uid
        gene._cluster = cluster.uid
      })
    })
  }

  function changeGeneColour(_, d) {
    let picker = d3.select("input.colourPicker")
    picker.on("change", () => {
      let value = picker.node().value
      let range = api.scales.colour.range()
      range[d] = value
      api.scales.colour.range(range)
      d3.selectAll(`.group-${d}`)
        .attr("fill", value)
    })
    picker.node().click()
  }

  function resizeScaleBar() {
    let result = prompt("Enter new length (bp):", api.config.scaleBar.basePair)
    if (result) {
      api.config.scaleBar.basePair = result
      api.plot.update()
    }
  }

  function getScaleBarFn() {
    return scaleBar(api.scales.x)
      .stroke(api.config.scaleBar.stroke)
      .height(api.config.scaleBar.height)
      .colour(api.config.scaleBar.colour)
      .basePair(api.config.scaleBar.basePair)
      .fontSize(api.config.scaleBar.fontSize)
      .onClickText(resizeScaleBar)
      .transition(transition)
  }

  function getColourBarFn() {
    return colourBar(api.scales.score)
      .width(api.config.colourBar.width)
      .height(api.config.colourBar.height)
      .fontSize(api.config.colourBar.fontSize)
      .transition(transition)
  }

  function getHiddenGeneGroups() {
    let hidden
    let genes = d3.selectAll("g.gene")
    if (genes.empty()) {
      hidden = []
    } else {
      hidden = api.scales.colour.domain()
      genes.each((d, i, n) => {
        let display = d3.select(n[i]).attr("display")
        let group = api.scales.group(d.uid)
        if (display === "inline" && group !== null && hidden.includes(group))
          hidden = hidden.filter(g => g !== group)
      })
    }
    return hidden 
  }

  function getLegendFn() {
    let hidden = getHiddenGeneGroups()
    return legend(api.scales.colour)
      .hidden(hidden)
      .fontSize(api.config.legend.fontSize)
      .entryHeight(api.config.legend.entryHeight)
      .onClickRect(api.config.legend.onClickRect || changeGeneColour)
      .onClickText(api.config.legend.onClickText)
  }

  my.config = function(_) {
    if (!arguments.length) return config
    api.plot.updateConfig(_)
    return my
  }

  return my
}
