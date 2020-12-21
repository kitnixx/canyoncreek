library(rjson)
library(lidR)
library(raster)
library(rgdal)
library(EBImage)
library(stringr)

arg <- commandArgs(TRUE)
baseDir <- arg[1]
result <- fromJSON(file = arg[2])

wd <- paste(baseDir, result["dir"], "/", sep = "")
shpFile <- paste(wd, result["shpFile"], sep = "")

baseDir
wd
shpFile

if(TRUE){
	aoi <- readOGR(shpFile)
	ctg <- readLAScatalog(wd)

	lascheck(ctg)
	opt_chunk_buffer(ctg)
	opt_chunk_size(ctg)
	opt_chunk_alignment(ctg)
	opt_wall_to_wall(ctg)


	outputClippedDir <- paste(str_remove(shpFile, ".shp"), "_clipped", sep = "")
	outputClippedDir
	#opt_output_files(ctg) <- outputClippedDir
	#las_clip <- lasclip(ctg, aoi)

	outputNormalizeDir <- paste(str_remove(shpFile, ".shp"), "_normalized", sep = "")
	outputNormalizeDir
	#opt_output_files(las_clip) <- outputNormalizeDir
	#las_normal <- lasnormalize(las_clip, tin())
}
