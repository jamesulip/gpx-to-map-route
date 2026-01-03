<template>

</template>
<script lang="ts" setup>
import { gpx } from '@tmcw/togeojson';

fetch("/Morning_Ride.gpx")
  .then(function (response) {
    return response.text();
  })
  .then(function (xml) {
    console.log(gpx(new DOMParser().parseFromString(xml, "text/xml")));
  });
</script>