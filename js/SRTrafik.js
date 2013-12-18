"use strict";
var trappen = trappen || {};

//----------------Options-----------------
trappen.timeOptions = { hour: "2-digit", minute: "2-digit" };
trappen.dateOptions = { year: "numeric", month: "2-digit", day: "2-digit" };

//------------Hjälpfunktioner-------------
trappen.loadMarkers = function (messages) {
    //Skapa objekt
    trappen.bounds = new google.maps.LatLngBounds();
    trappen.infowindow = new google.maps.InfoWindow({ maxWidth: 400 });
    trappen.mapOptions = {
        mapTypeId: 'roadmap'
    };
    //Finns det inga meddelanden?
    if (messages.length == 0) {
        document.getElementById("map-canvas").innerHTML = "";
        return; //avbryt
    }
    trappen.map = new google.maps.Map(document.getElementById("map-canvas"),
        trappen.mapOptions);
    trappen.map.setTilt(45);
    //Skapa markers för alla meddelanden
    for (var i = 0; i < messages.length; i++) {
        trappen.currentPosition = new google.maps.LatLng(messages[i].latitude, messages[i].longitude);
        //Uppdatera yttersta kart-positioner
        trappen.bounds.extend(trappen.currentPosition);
        trappen.marker = new google.maps.Marker({
            position: trappen.currentPosition,
            map: trappen.map,
            title: messages[i].description,
            icon: 'css/images/marker' + messages[i].priority + '.png'
        });
        //Skapa klick-funktion
        google.maps.event.addListener(trappen.marker, 'click', (function (marker, i) {
            return function () {
                trappen.infowindow.setContent(trappen.getMarkerHtml(messages[i]));
                trappen.infowindow.open(trappen.map, marker);
            }
        })(trappen.marker, i));
    }



    //Ställ in min-zoom, asynchront.
    google.maps.event.addListener(trappen.map, 'zoom_changed', function () {
        trappen.zoomChangeBoundsListener =
            google.maps.event.addListener(trappen.map, 'bounds_changed', function (event) {
                if (this.getZoom() > 10 && this.initialZoom == true) {
                    this.setZoom(10);
                    this.initialZoom = false;
                }
                //Kör det bara en gång.
                google.maps.event.removeListener(trappen.zoomChangeBoundsListener);
            });
    });
    //Skala och anpassa kartan efter markers.
    trappen.map.initialZoom = true;
    trappen.map.fitBounds(trappen.bounds);
}

trappen.displayMessages = function (messages) {
    //Finns det inga meddelanden?
    if (messages.length == 0) {
        $("#messages").html("<h3>Inga trafikhändelser att visa.</h3>");
        return; //avbryt
    }
    $("#messages").html("").append("<div class='trafficDate'>Hämtat " + trappen.dateToHtml(messages[0].createddate) + "</div>");
    //Html-kod för varje message.
    messages.forEach(function (message) {
        $("#messages").append("<div class='trafficMessage'><div class='trafficCategory'>" +
            trappen.categoryToHtml(message.category) +
            "</div><div class='trafficSubCategory'>" +
            message.subcategory + "</div><div class='trafficPriority'>" +
            trappen.priorityToHtml(message.priority) + "</div><h3 class='trafficHeader'>" + message.title +
            "</h3><p class='trafficDescription'>" + message.description + "</p></div>");
    });
}

trappen.getMarkerHtml = function (message) {
    return "<div class='markerInfo'><div class='trafficPriority'>" +
    trappen.priorityToHtml(message.priority) + "</div><h3 class='trafficHeader'>" + message.title +
    "</h3><div class='markerDate'>" + trappen.dateToHtml(message.createddate) +
    "</div><div class='trafficCategory'>" +
    trappen.categoryToHtml(message.category) +
    "</div><div class='trafficSubCategory'>" +
    message.subcategory + "</div><p class='trafficDescription'>" + message.description + "</p></div></div>";
}

trappen.dateToHtml = function (dateString) {
    //Parsa datumet
    try {
        trappen.currentDate = new Date(Date(dateString.slice(6, -7)));
        return "kl " + trappen.currentDate.toLocaleTimeString("sv-SE", trappen.timeOptions) + ", " +
        trappen.currentDate.toLocaleDateString("sv-SE", trappen.dateOptions);
    } catch (e) {
        Console.log(e.message);
        return "Kunde inte tolka datumet";
    }
}

trappen.categoryToHtml = function (categoryNo) {
    //Hämta kategori i klartext
    switch (categoryNo) {
        case 0:
            return "Vägtrafik";
        case 1:
            return "Kollektivtrafik";
        case 2:
            return "Planerad störning";
        case 3:
            return "Övrigt";
        default:
            return "";
    }
}

trappen.priorityToHtml = function (priorityNo) {
    //Skapa prioritets-symbol.
    switch (priorityNo) {
        case 1:
            return "<div class='incident verySeriousIncident' title='Mycket allvarlig händelse'></div>";
        case 2:
            return "<div class='incident SeriousIncident' title='Stor händelse'></div>";
        case 3:
            return "<div class='incident disruption' title='Störning'></div>";
        case 4:
            return "<div class='incident information' title='Information'></div>";
        case 5:
            return "<div class='incident minorDisruption' title='Mindre störning'></div>";
        default:
            return "";
    }
}

//-------------Event handlers------------------------
$("#selectCategory").change(function () {
    if ($(this).val() == 4) {
        trappen.filteredMessages = trappen.messages;
    } else {
        trappen.filteredMessages = $.grep(trappen.messages, function (message) {
            return message.category == $("#selectCategory").val();
        });
    }
    trappen.loadMarkers(trappen.filteredMessages);
    trappen.displayMessages(trappen.filteredMessages);
});


//-------------AJAX----------------------------------
//Hämta trafikinfo med JSONP
//Upp till 100 meddelanden
trappen.trafikURL = 'http://api.sr.se/api/v2/traffic/messages?pagination=true&page=1&size=100&format=json';
trappen.loadTraffic = function () {
    trappen.ajax = $.ajax({
        url: trappen.trafikURL,
        type: "GET",
        cache: true,
        timeout: 10000,
        dataType: "jsonp",
        beforeSend: function () {
        },
        //Körs alltid.
        complete: function () {
        },
        success: function (result) {
            trappen.messages = result.messages;
            trappen.loadMarkers(trappen.messages);
            trappen.displayMessages(trappen.messages);
        },
        error: function (request, status, error) {
            if (status === "timeout") {
                alert("SR's server gjorde timeout");
            }
            else {
                Console.log('Följande fel uppstod: ' + status + ' ' +
                    error + ' ' + request.responseText);
            }
        }
    });
}

//------------Start app-----------------
trappen.loadTraffic();