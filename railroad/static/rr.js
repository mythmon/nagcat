﻿/*
 * Copyright 2010 ITA Software, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/******* GLOBALS ********/

// Base for data manipulation
// TODO: Find a way to remove global variable?
base = 0;

/******* FLOT HELPER FUNCTIONS *******/

// Choose a base for graph axis
function chooseBase(max) {
    // Memoizes results!
    if (this.chooseBase.result != undefined &&
        this.chooseBase.result.max == max) {
        return result;
    }
    bases = ['', 'K', 'M', 'G', 'T'];
    for(interval = 0; interval < bases.length; interval++) {
        if(max / (Math.pow(base, interval)) <= base) {
            break;
        }
    }
    var result = new Array();
    result.interval = interval;
    result.bases = bases;
    result.max = max;
    return result;
}

// Generate ticks, passed as an option to Flot
function tickGenerator(range) {
    result = chooseBase(range.max);
    interval = result.interval

    final_base = Math.pow(base, interval);

    var noTicks = 0.3 * Math.sqrt($(".graph").height());
    
    var delta = ((range.max - range.min) / final_base) / noTicks,
        size, generator, unit, formatter, i, magn, norm;

    // Pretty rounding of base-10 numbers
    var dec = -Math.floor(Math.log(delta) / Math.LN10);

    magn = Math.pow(10, -dec);
    norm = delta / magn; // norm is between 1.0 and 10.0
    
    if (norm < 1.5)
        size = 1;
    else if (norm < 3) {
        size = 2;
        // special case for 2.5, requires an extra decimal
        if (norm > 2.25) {
            size = 2.5;
            ++dec;
        }
    }
    else if (norm < 7.5)
        size = 5;
    else
        size = 10;

    size *= magn;
    size *= final_base;

    var ticks = [];
    x = 0;
    for(tick = range.min; tick < range.max+size; tick+=size) {
        ticks[x++] = tick;
    }
    return ticks;
}

// Format ticks for displayed, passed as option to Flot
function tickFormatter(val, axis) {
    result = chooseBase(axis.max);
    interval = result.interval;
    bases = result.bases;

    final_base = (Math.pow(base, interval));

    // flot computes tickDecimals before dividing by final_base, so we update
    // tickDecimals accordingly
    if (final_base != 1) {
        tickDecimals = axis.tickDecimals;
        while (tickDecimals <= 3 && 
			(val / final_base).toFixed(tickDecimals) != val / final_base)
            tickDecimals++;

		if (tickDecimals <= 3)
			axis.tickDecimals = tickDecimals; 
    }

    return (val / final_base).toFixed(axis.tickDecimals) + bases[interval];
}

// Format a label, passed to Flot
function labelFormatter(label, series) {
    return label.replace(/_/g, ' ');
}

/******* GRAPH GENERATION/MANIPULTION *******/

// Takes the raw data and sets up required Flot formatting options
function formatGraph(element, data) {
    base = data.base;

    data.options.yaxis.ticks = tickGenerator;
    data.options.yaxis.tickFormatter = tickFormatter;

    // TODO: Cleanup legend and axis label creation
    data.options.legend = {}
    data.options.legend.container = $(element).next('.legend');
    data.options.legend.labelFormatter = labelFormatter;
    return data;
}

// Creates a graph
function createGraph(element, path, callback, zoom) {
    // If the graph isn't busy
    if(!$(element).data('busy')) {
        $(element).data('busy', true);
        $(element).append('<div class="throbber"></div>');
        $(element).remove('.empty');
        $.ajax({
            url: '/railroad/parserrd/' + path,
            dataType: 'json',
            success: function(data) {
                // If we are zooming and there's no data, just bail with an
                // error
                if(zoom && data.empty) {
                    plot = $(element).data('plot');
                    plot.clearSelection();
                    $(element).append('<div class="error">no data to ' +
                                      'zoom</div>');
                    // Nice fadeOut won't let us remove the element, so use a
                    // callback
                    $(element).find('.error')
                              .delay(500)
                              .fadeOut(500,
                                       function() {
                                           $(this).remove();
                                       });
                } else {
                    data = formatGraph(element, data);
                    $(element).data('plot',
                                    $.plot($(element),
                                    data.data,
                                    data.options));
                    $(element).data('start',
                                    data.start);
                    $(element).data('end',
                                    data.end);
                    if(data.options.yaxis.label) {
                        // if there isn't already a ylabel
                        if ($(element).siblings('.ylabel').length == 0) {
                            $(element).before('<div class="ylabel">' +
                                              data.options.yaxis.label + '</div>');
                        }
                    }
                    if(data.empty == true) {
                        $(element).append('<div class="empty">no data</div>');
                    }

                    update = $(element).closest('.graph_container') .find('.update')
                                 .html('updated: ' + data.current_time);

                    // get the graphs collapsed/expanded as they should be.
                    $('#expansion_by_type').children().trigger('change');

                    if(callback != null) {
                        callback(data);
                    }
                }
                $(element).find('.throbber').remove();
            },
            // If there's an error, toss out a warning about it
            error: function(request, status, error) {
                plot = $(element).data('plot');
                if(zoom) {
                    plot.clearSelection();
                }
                $(element).find('.throbber').remove();
                $(element).append('<div class="error">error</div>');
                if(zoom) {
                    // Nice fadeOut won't let us remove the element, so use a
                    // callback
                    $(element).find('.error')
                              .delay(500)
                              .fadeOut(500,
                                       function() {
                                           $(this).remove();
                                       });
                }
            }
        });
    // Release the graph
    $(element).data('busy', null);
    }
}

// Grabs the default state for the configurator
function defaultState() {
    // If we're on a configurator page, load the default state
    if($('#configurator') != undefined) {
        $.getJSON('/railroad/configurator/formstate', function(data) {
            $('#configurator').data('state', data);
        });
        $('#configurator').show();
    }
}

// Parse and setup graphs on the page
function parseGraphs(index, element) {

    // Don't set up graphs already set up
    $(element).addClass('setup');

    // Store the graph data for usage later
    path = $(element).find('a').attr('href');
    splitPath = path.split('/');
    $(element).data('host', splitPath[0]);
    $(element).data('service', splitPath[1]);
    $(element).data('start', splitPath[2]);
    $(element).data('end', splitPath[3]);
    $(element).data('res', splitPath[4]);

    createGraph(element, path);

    // Allow for zooming
    $(element).bind('plotselected', function (event, ranges) {
        // The graph isn't busy anymore, allow updates
        $(element).data('busy', null); 

        // If we are supposed to sync the graphs, loop over all graphs
        if($('#sync').attr('checked')) {
            graphs = $('.graph');
            // Allow us to zoom even when it makes no sense if we are
            // synced
            zoom = false;
        // Otherwise only loop over the graph associated with this button
        } else {
            graphs = $(element);
            zoom = true;
        }

        graphs.each(function(index, element) {

            serviceData = $(element).data();

            path = [serviceData.host,
                    serviceData.service,
                    parseInt(ranges.xaxis.from / 1000),
                    parseInt(ranges.xaxis.to / 1000),
                    serviceData.res].join('/');

            createGraph(element,
                        path,
                        function() {
                            $(element).removeClass('ajax');
                            zoomButton = $(element)
                                            .closest('.graph_container')
                                            .find('.zoom');
                            selected = $(element)
                                            .closest('.graph_container')
                                            .find('.selected');
                            selected.removeClass('selected');
                            zoomButton.css('visibility', 'visible');
                            zoomButton.addClass('selected');
                        },
                        zoom);
        });
    });
    $(element).bind('plotselecting', function() {
        // If we are selecting, mark the graph as busy so no AJAX fires
        $(element).data('busy', true);
    });

}

// Function to automatically update any graphs which are set to ajax load
function autoFetchData() {
    $('.graph.ajax').each(function(index, element) {
        serviceData = $(element).data();
        time = new Date();
        end = parseInt(time.getTime() / 1000);
        start = parseInt(end - 60 * 60 * 24);

        path = [serviceData.host,
                serviceData.service,
                start,
                end,
                serviceData.res].join('/');

        createGraph(element, path);
    });
    setTimeout(autoFetchData, 60 * 1000);
}

/******* DOM HOOK SETUP *******/

// Execute setup code when page loads
$(document).ready(function() {
    // Kick off grabbing the default state so hopefully it gets there before
    // the user iteracts
    defaultState();

    /**** GRAPH SETUP ****/

    // Bind the graph time range selection buttons
    $('.options ul li').live('click', function() {
        clicked = $(this);
        // If we are supposed to sync the graphs, loop over all graphs
        if($('#sync').attr('checked')) {
            graphs = $('.graph');
        // Otherwise only loop over the graph associated with this button
        } else {
            graphs = $(this).closest('.graph_container')
                             .find('.graph');
        }
        graphs.each(function(index, graph) {
            button = $(graph).closest('.graph_container')
                             .find('.year');
            time = new Date();
            end = parseInt(time.getTime() / 1000);

            // Depending on which button is hit, change the behavior
            // TODO: Look at possibilities at cleaning this up

            if(clicked.hasClass('zoom')) {
                return;
            }

            $(graph).closest('.graph_container')
                    .find('.zoom')
                    .css('visibility', 'hidden');

            if(clicked.hasClass('reset')) {
                $(graph).addClass('ajax');
            } else {
                $(graph).removeClass('ajax');
            }
           
            if(clicked.hasClass('day') || clicked.hasClass('reset')) {
                start = parseInt(end - 60 * 60 * 24);
            } else if(clicked.hasClass('week')) {
                start = parseInt(end - 60 * 60 * 24 * 7);
            } else if(clicked.hasClass('month')) {
                start = parseInt(end - 60 * 60 * 24 * 30);
            } else if(clicked.hasClass('year')) {
                start = parseInt(end - 60 * 60 * 24 * 365);
            }

            serviceData = $(graph).data();

            path = [serviceData.host,
                    serviceData.service,
                    start,
                    end,
                    serviceData.res].join('/');

            createGraph(graph,
                        path,
                        function() {
                            $(graph).closest('.graph_container')
                                    .find('.options .selected')
                                    .removeClass('selected');
                            // This is pretty horrible, perhaps there is a
                            // better way
                            if(clicked.hasClass('reset')) {
                                buttonClass = '.reset';
                            } else if(clicked.hasClass('day')) {
                                buttonClass = '.day';
                            } else if(clicked.hasClass('week')) {
                                buttonClass = '.week';
                            } else if(clicked.hasClass('month')) {
                                buttonClass = '.month';
                            } else if(clicked.hasClass('year')) {
                                buttonClass = '.year';
                            } else if(clicked.hasClass('zoom')) {
                                buttonClass = '.zoom';
                            }
                            $(graph).closest('.graph_container')
                                    .find(buttonClass)
                                    .addClass('selected');
                        });
        });
    });

    // Initialize the data for any graphs already on the page
    $(".graph").each(parseGraphs);

    /**** CONFIGURATOR SETUP ****/
	// TODO: delete remnants (most of it) carefully!

    // Autocomplete anything with class = "... autocomplete ..."
    $('.autocomplete').each(function () { 
        $(this).autocomplete ( { source : "/railroad/ajax/autocomplete/" + $(this).attr('name' ), minLength : 1, autoFocus: true})
    });

    $('#cleargraphs').click(function () {
        $('.service_row').remove();
        $('#configurator').data('changed', true);
    });

    // Handle configurator form submissions
    $('#configurator').submit(function() {
        $(this).append('<div class="throbber"></div>');
        // Enable the fields again so they can be submitted
        $('[id^=type]').attr('disabled', null);
        $('[id^=value]').attr('disabled', null);


        fields = $('#configurator').formSerialize();
        $.ajax({
            data: fields,
            dataType: 'html',
            url: $('#configurator').attr('action'),
            success: function(data, textStatus, XMLHttpRequest) {
                //reset_fields();
                $('#configurator').trigger('reset');
                // Add the new graph and setup the new graphs
                $('#graphs').append(data);
                $('.graph:not(.setup)').each(parseGraphs);
                $('#configurator').find('.throbber').remove();
            },
            error: function(XMLHttpRequest, textStatus, errorThrown) {
                // TODO: Indicate error somehow, probably
                $('#configurator').find('.throbber').remove();
            }
        });
        $('#configurator').data('changed', true);
        // Delete extra cloned buttons
        var cloned_hosts = $('.clonedHost').length;
        var cloned_groups = $('.clonedGroup').length;
        var cloned_services = $('.clonedService').length;

        for (var i=cloned_hosts; i >1; i--) {
            $('#hostdiv' + i).remove();
        }

        for (var i=cloned_groups; i > 1; i--) {
            $('#groupdiv' + i).remove();
        }

        for (var i=cloned_services; i > 1; i--) {
            $('#servicediv' + i).remove();
        }
        // Prevent normal form submission
        return false;
    });

    // **********  Functions to collapse rows **************
    var collapse_time = 250;
    function collapse_row(row) {
        // Hide the graph and status text
        $(row).children('.graph_container').children().hide(collapse_time);
        $(row).children('.status_text').children('p').hide(collapse_time);
        $(row).children('.status_text').children('h2').css({'display': 'inline'});

        // change the button to expand
        $(row).children('.controls').children('div').removeClass('collapse');
        $(row).children('.controls').children('div').addClass('expand');
    }
    function expand_row(row) {
        // Hide the graph and status text
        $(row).children('.graph_container').children().show(collapse_time);
        $(row).children('.status_text').children('p').show(collapse_time);
        $(row).children('.status_text').children('h2').css({'display': 'block'});

        // change the button to expand
        $(row).children('.controls').children('div').removeClass('expand');
        $(row).children('.controls').children('div').addClass('collapse');
    }

    $('#expandall').click(function() {
        $('tr.service_row').each(function(index, row) {
            expand_row(row);
        });
        $('#expansion_by_type').children().prop('checked', true);
    });
    $('#collapseall').click(function() {
        $('tr.service_row').each(function(index, row) {
            collapse_row(row);
        });
        $('#expansion_by_type').children().prop('checked', false);
    });

    $('.collapse').live('click', function() {
        collapse_row($(this).parents().parents().first());
    });
    $('.expand').live('click', function() {
        expand_row($(this).parents().parents().first());
    });

    // *************************** Auto collapse ***************************
    // set up events on each checkbox to collapse/expand the service_rows to
    // match the current state of the checkbox.
    $('#expansion_by_type').children().bind('change', function() {
        var checkbox = this;
        $('.service_row').each(function(index, element) {
            if ($(element).find('*').hasClass($(checkbox).attr('name'))) {
                if ($(checkbox).prop('checked')) {
                    expand_row(element);
                } else {
                    collapse_row(element);
                }
            }
        });
    });

    // TODO: This should pull from sort of preferences
    $('[name=state_ok]').prop('checked', false);
    $('[name=state_warning]').prop('checked', true);
    $('[name=state_critical]').prop('checked', true);
    $('[name=state_unknown]').prop('checked', true);

    // Handle configurator link generation
    $('#static').click(function() {
        function paint_link(data) {
            $('#link').html('Link: <input type="text" name="link"' +
                            ' readonly value="' + data + '" size="25" />');
            $('#link input').focus()
                            .select();
        }

        // If there are any service rows, we have a custom link to generate
        if($('.service_row').size()) {
            services = new Array();
            $('.service_row').each(function(index, element) {
                temp = $(element).find('.service_data').attr('href').split('/');
                host = temp[0];
                service = temp[1];
                start = $(element).find('.graph').data('start');
                end = $(element).find('.graph').data('end');
                services[index] = [host, service, start, end];
            });
            data = {services: services};
            $.ajax({
                data: data,
                dataType: 'json',
                type: 'POST',
                url: '/railroad/configurator/generatelink',
                success: function(data) {
                    paint_link(data);
                },
                error: function(XMLHttpRequest, textStatus, errorThrown) {
                    // TODO: Handle error?
                }
            });
        // If not, give a link to the page
        } else {
             paint_link(window.location);
        } 
    });

    // Handle configurator link generation
    $('#live').click(function() {
        function paint_link(data) {
            $('#link').html('Link: <input type="text" name="link"' +
                            ' readonly value="' + data + '" size="25" />');
            $('#link input').focus()
                            .select();
        }

        // If anything on the page has changed, give them a link to that exact
        // zoom, configuration, etc
        if($('#configurator').data('changed')) {
            services = new Array();
            $('.service_row').each(function(index, element) {
                temp = $(element).find('.service_data').attr('href').split('/');
                host = temp[0];
                service = temp[1];
                if($(element).find('.graph').data('start')) {
                    start = -1;
                } else {
                    start = null;
                }
                if($(element).find('.graph').data('end')) {
                    end = -1;
                } else {
                    end = null;
                }

                services[index] = [host, service, start, end];
            });
            data = {services: services};
            $.ajax({
                data: data,
                dataType: 'json',
                type: 'POST',
                url: '/railroad/configurator/generatelink',
                success: function(data) {
                    paint_link(data);
                },
                error: function(XMLHttpRequest, textStatus, errorThrown) {
                    // TODO: Handle error?
                }
            });
        // If not, give them a generic link to this page
        } else {
            paint_link(window.location);
        }
    });


    // Automatically focus the link when someone clicks
    $('#link input').live('click', function() {
        $(this).focus()
               .select();
    });

    // Automatically delete the link if we defocus
    $('#link input').live('blur', function() {
        $('#link').empty();
    });

    /**** MISC ***/

    // Start the AJAX graph refreshes
    setTimeout(autoFetchData, 60 * 1000);

});
