class Timeline {
    constructor(parentElement, timeData, videoP, iframeId) {  // Add iframeId parameter
        this.parentElement = parentElement;
        this.timeData = timeData;
        this.videoP = videoP;
        this.iframeId = iframeId;  // Store iframe ID
        this.currentTime = 0;
        this.videoDuration = 0;
        this.getVideoDuration().then(() => {
            this.initVis();
            this.initPlayerSync();
        });
    }


    async getVideoDuration() {
        return new Promise(async (resolve) => {
            console.log('Starting duration check');

            try {
                const iframe = document.getElementById(this.iframeId);  // Use stored iframe ID
                if (!iframe) {
                    throw new Error(`Iframe ${this.iframeId} not found`);
                }

                const bvMatch = iframe.src.match(/bvid=([^&]+)/);

                if (bvMatch && bvMatch[1]) {
                    const bvid = bvMatch[1];
                    console.log('BV ID:', bvid);

                    const response = await fetch(`http://localhost:3000/api/bilibili-proxy?bvid=${bvid}`);
                    const data = await response.json();
                    console.log(data);

                    if (data.code === 0 && data.data && data.data.duration) {
                        console.log('Got duration from API:', data.data.pages[this.videoP].duration);
                        this.videoDuration = data.data.pages[this.videoP].duration;
                        resolve();
                        return;
                    }
                }
            } catch (error) {
                console.error('Error fetching duration:', error);
            }

            // Fallback
            console.log('Using default duration: 600');
            this.videoDuration = 600;
            resolve();
        });
    }

    initPlayerSync() {
        // Store iframe ID in closure for event handler
        const iframeId = this.iframeId;

        window.addEventListener('message', (e) => {
            const iframe = document.getElementById(this.iframeId);
            if (!iframe) return;

            // Only process messages from our specific iframe
            if (e.source === iframe.contentWindow && e.data && e.data.type === 'videoProgress') {
                this.currentTime = e.data.currentTime;
                this.updateVis();
            }
        });

        // Set up polling for current time
        setInterval(() => {
            const iframe = document.getElementById(this.iframeId);
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    type: 'getCurrentTime'
                }, '*');
            }
        }, 1000);
    }

    initVis() {
        let vis = this;
        vis.margin = { top: 40, right: 40, bottom: 40, left: 40 };
        vis.width = this.parentElement.getBoundingClientRect().width - vis.margin.left - vis.margin.right;
        vis.height = 100 - vis.margin.top - vis.margin.bottom;

        // Create SVG container
        vis.svg = d3.select(vis.parentElement)
            .append("svg")
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
            .append("g")
            .attr("transform", `translate(${vis.margin.left},${vis.margin.top})`);

        // Initialize scales using video duration
        vis.xScale = d3.scaleLinear()
            .domain([0, this.videoDuration])
            .range([0, vis.width]);

        // Add floor sections background group
        vis.floorSectionsGroup = vis.svg.append("g")
            .attr("class", "floor-sections");

        // Add the timeline base line
        vis.svg.append("line")
            .attr("class", "timeline-base")
            .attr("x1", 0)
            .attr("y1", vis.height / 2)
            .attr("x2", vis.width)
            .attr("y2", vis.height / 2)
            .attr("stroke", "#e5e7eb")
            .attr("stroke-width", 2);

        // Add click area for timeline
        vis.svg.append("rect")
            .attr("class", "timeline-click-area")
            .attr("x", 0)
            .attr("y", vis.height / 2 - 10)
            .attr("width", vis.width)
            .attr("height", 20)
            .attr("fill", "transparent")
            .style("cursor", "pointer")
            .on("click", (event) => this.handleTimelineClick(event))
            .on("mousemove", (event) => this.handleTimelineHover(event))
            .on("mouseout", () => this.handleTimelineMouseOut());

        // Add progress indicator
        vis.progressLine = vis.svg.append("line")
            .attr("class", "progress-line")
            .attr("y1", 0)
            .attr("y2", vis.height)
            .attr("stroke", "#3b82f6")
            .attr("stroke-width", 2);

        // Add hover tooltip container
        vis.tooltip = d3.select(vis.parentElement)
            .append("div")
            .attr("class", "timeline-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background-color", "white")
            .style("padding", "5px")
            .style("border", "1px solid #ddd")
            .style("border-radius", "4px");

        // Convert timestamps and add markers
        this.addTimeMarkers();
        this.wrangleData();
    }

    handleTimelineClick(event) {
        const clickX = d3.pointer(event)[0];
        const clickTime = this.xScale.invert(clickX);

        // Find the nearest floor marker before the click
        const floorMarkers = this.timeData.filter(d => d.type === 'newFloor');
        const nearestFloor = floorMarkers.reduce((prev, curr) => {
            if (curr.seconds <= clickTime && (!prev || curr.seconds > prev.seconds)) {
                return curr;
            }
            return prev;
        }, null);

        if (nearestFloor) {
            this.currentTime = nearestFloor.seconds;
            const iframe = document.getElementById(this.iframeId);
            if (iframe) {
                const currentSrc = iframe.src;
                const baseUrl = currentSrc.split('&t=')[0];
                iframe.src = `${baseUrl}&t=${nearestFloor.seconds}`;
            }
            this.updateVis();
        }
    }

    handleTimelineHover(event) {
        const hoverX = d3.pointer(event)[0];
        const hoverTime = this.xScale.invert(hoverX);

        // Find current floor section
        const floorMarkers = this.timeData.filter(d => d.type === 'newFloor');
        const currentFloor = floorMarkers.reduce((prev, curr) => {
            if (curr.seconds <= hoverTime && (!prev || curr.seconds > prev.seconds)) {
                return curr;
            }
            return prev;
        }, null);

        if (currentFloor) {
            this.tooltip
                .style("visibility", "visible")
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY - 25}px`)
                .html(`Floor ${currentFloor.floor}`);
        }
    }

    handleTimelineMouseOut() {
        this.tooltip.style("visibility", "hidden");
    }

    addFloorSections() {
        let vis = this;

        // Get floor markers and sort them by time
        const floorMarkers = this.timeData
            .filter(d => d.type === 'newFloor')
            .sort((a, b) => a.seconds - b.seconds);

        // Create sections between floor markers
        const sections = [];
        for (let i = 0; i < floorMarkers.length; i++) {
            const startTime = floorMarkers[i].seconds;
            const endTime = (i < floorMarkers.length - 1)
                ? floorMarkers[i + 1].seconds
                : this.videoDuration;

            sections.push({
                start: startTime,
                end: endTime,
                floor: floorMarkers[i].floor
            });
        }

        // Create color scale for floors
        const floorColors = {
            0: '#808080',    // gray
            1: '#b1b16f',    // gray yellow
            2: '#FFEFA1',    // light yellow
            3: '#bbb08c',    // iron yellow
            4: '#E6B8B8',    // light red
            5: '#ff0000',    // red
            6: '#54b854'     // green
        };

        // Create color scale for floors
        const colorScale = (floor) => {
            return floorColors[floor] || '#808080'; // Default to gray if floor not found
        };

        // Add colored sections
        vis.floorSectionsGroup.selectAll(".floor-section")
            .data(sections)
            .join("rect")
            .attr("class", "floor-section")
            .attr("x", d => vis.xScale(d.start))
            .attr("y", vis.height / 2 - 10)
            .attr("width", d => vis.xScale(d.end) - vis.xScale(d.start))
            .attr("height", 20)
            .attr("fill", d => colorScale(d.floor))
            .attr("opacity", 0.3);
    }

    addTimeMarkers() {
        let vis = this;

        // Convert time strings to seconds for markers
        const timeMarkers = this.timeData.map(d => ({
            seconds: this.timeToSeconds(d.time),
            time: d.time
        }));

        // Add marker lines
        vis.svg.selectAll(".time-marker-line")
            .data(timeMarkers)
            .enter()
            .append("line")
            .attr("class", "time-marker-line")
            .attr("x1", d => vis.xScale(d.seconds))
            .attr("x2", d => vis.xScale(d.seconds))
            .attr("y1", vis.height / 2 - 5)
            .attr("y2", vis.height / 2 + 5)
            .attr("stroke", "#d1d5db")
            .attr("stroke-width", 1);

        // Add marker labels
        vis.svg.selectAll(".time-marker-label")
            .data(timeMarkers)
            .enter()
            .append("text")
            .attr("class", "time-marker-label")
            .attr("x", d => vis.xScale(d.seconds))
            .attr("y", vis.height / 2 + 20)
            .attr("text-anchor", "middle")
            .style("font-size", "10px")
            .style("fill", "#6b7280")
            .text(d => d.time);
    }

    wrangleData() {
        let vis = this;

        // Convert time strings to seconds for proper scaling
        vis.timeData = vis.timeData.map(d => ({
            ...d,
            seconds: this.timeToSeconds(d.time)
        }));

        this.addFloorSections();
        this.updateVis();
    }

    updateVis() {
        let vis = this;

        // Split data into dots and bars
        const dotData = vis.timeData.filter(d => d.type !== 'newFloor');
        const barData = vis.timeData.filter(d => d.type === 'newFloor');

        // Update dots
        const dots = vis.svg.selectAll(".timeline-dot")
            .data(dotData);

        // Enter
        const dotsEnter = dots.enter()
            .append("circle")
            .attr("class", "timeline-dot")
            .attr("r", 6)
            .attr("cy", vis.height / 2)
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                // Update current time immediately
                this.currentTime = d.seconds;

                // Update iframe source
                const iframe = document.getElementById(this.iframeId);
                if (iframe) {
                    const currentSrc = iframe.src;
                    const baseUrl = currentSrc.split('&t=')[0];
                    iframe.src = `${baseUrl}&t=${d.seconds}`;
                }

                // Update all dots and progress line
                this.updateDotsColor();
                this.updateProgressLine();
            })
            .on("mouseover", function(event, d) {
                // Enlarge dot and show tooltip
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", 8);

                d3.select(vis.parentElement)
                    .append("div")
                    .attr("class", "tooltip")
                    .style("position", "absolute")
                    .style("left", `${event.pageX + 10}px`)
                    .style("top", `${event.pageY - 25}px`)
                    .html(`${d.time}<br>${d.event}`);
            })
            .on("mouseout", function() {
                // Reset dot size and remove tooltip
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", 6);

                d3.select(vis.parentElement)
                    .selectAll(".tooltip")
                    .remove();
            });

        // Update + Enter
        dots.merge(dotsEnter)
            .transition()
            .duration(200)
            .attr("cx", d => vis.xScale(d.seconds));

        // Initial color update
        this.updateDotsColor();

        // Exit
        dots.exit().remove();

        // Update floor bars
        const bars = vis.svg.selectAll(".floor-bar")
            .data(barData);


        // Enter bars
        const barsEnter = bars.enter()
            .append("rect")
            .attr("class", "floor-bar")
            .attr("y", vis.height / 2 - 20)
            .attr("height", 40)
            .attr("width", 4)
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                this.currentTime = d.seconds;
                const iframe = document.getElementById(this.iframeId);
                if (iframe) {
                    const currentSrc = iframe.src;
                    const baseUrl = currentSrc.split('&t=')[0];
                    iframe.src = `${baseUrl}&t=${d.seconds}`;
                }
                this.updateDotsColor();
                this.updateBarsColor();
                this.updateProgressLine();
            })
            .on("mouseover", function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("width", 6);

                d3.select(vis.parentElement)
                    .append("div")
                    .attr("class", "tooltip")
                    .style("position", "absolute")
                    .style("left", `${event.pageX + 10}px`)
                    .style("top", `${event.pageY - 25}px`)
                    .html(`Floor ${d.floor}<br>${d.time}`);
            })
            .on("mouseout", function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("width", 4);

                d3.select(vis.parentElement)
                    .selectAll(".tooltip")
                    .remove();
            });

        // Update + Enter bars
        bars.merge(barsEnter)
            .transition()
            .duration(200)
            .attr("x", d => vis.xScale(d.seconds) - 2);

        // Exit bars
        bars.exit().remove();

        this.updateBarsColor();

        this.updateProgressLine();

        // Add type labels above dots
        const labels = vis.svg.selectAll(".timeline-label")
            .data(dotData);

        // Enter
        const labelsEnter = labels.enter()
            .append("text")
            .attr("class", "timeline-label")
            .attr("text-anchor", "middle")
            .attr("y", -10)
            .style("font-size", "12px")
            .style("fill", "#6b7280");

        // Update + Enter
        labels.merge(labelsEnter)
            .attr("x", d => vis.xScale(d.seconds))
            .text(d => d.type);

        // Exit
        labels.exit().remove();

        // Add floor numbers above bars
        const floorLabels = vis.svg.selectAll(".floor-label")
            .data(barData);

        // Enter floor labels
        const floorLabelsEnter = floorLabels.enter()
            .append("text")
            .attr("class", "floor-label")
            .attr("text-anchor", "middle")
            .attr("y", vis.height / 2 - 25)
            .style("font-size", "12px")
            .style("fill", "#6b7280");

        // Update + Enter floor labels
        floorLabels.merge(floorLabelsEnter)
            .attr("x", d => vis.xScale(d.seconds))
            .text(d => `F${d.floor}`);

        // Exit floor labels
        floorLabels.exit().remove();

    }

    updateDotsColor() {
        this.svg.selectAll(".timeline-dot")
            .transition()
            .duration(200)
            .attr("fill", d => {
                if (d.seconds <= this.currentTime) {
                    return "#4477ff";  // Blue for current and past dots
                } else {
                    return "#cccccc";  // Gray for future dots
                }
            })
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 2);
    }

    updateBarsColor() {
        this.svg.selectAll(".floor-bar")
            .transition()
            .duration(200)
            .attr("fill", d => {
                if (d.seconds <= this.currentTime) {
                    return "#4477ff";  // Blue for current and past bars
                } else {
                    return "#cccccc";  // Gray for future bars
                }
            });
    }

    updateProgressLine() {
        this.progressLine
            .transition()
            .duration(100)
            .ease(d3.easeLinear)
            .attr("x1", this.xScale(this.currentTime))
            .attr("x2", this.xScale(this.currentTime));
    }

    timeToSeconds(timeStr) {
        const [minutes, seconds] = timeStr.split(':').map(Number);
        return minutes * 60 + seconds;
    }
}