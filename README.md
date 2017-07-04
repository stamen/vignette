# vignette
Generate sample images for regions/zooms.

Set up your locations and zoom levels in `config.json`


Vignettes from a local xml file compiled for TileMill/Mapnik:

```vignette -o vignettes -c config.json -w 600 -h 400 mapnik://./project.xml```

Vignettes from the web:

```vignette -o web_vignettes -c config.json -w 600 -h 400 'tilejson+http://tile.stamen.com/toner/{z}/{x}/{y}.png'```
